package dev.formetric.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.unit.DataSize;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
final class RequestBodySizeLimitFilter extends OncePerRequestFilter {

    private static final int READ_BUFFER_SIZE = 8 * 1024;
    private static final int MAX_SAFE_BODY_BYTES = 256 * 1024;

    private final int maxBodyBytes;
    private final ObjectMapper objectMapper;

    RequestBodySizeLimitFilter(
            @Value("${formetric.http.max-request-body-size:256KB}") DataSize maxRequestBodySize,
            ObjectMapper objectMapper) {
        long configuredBytes = maxRequestBodySize.toBytes();
        if (configuredBytes <= 0 || configuredBytes > MAX_SAFE_BODY_BYTES) {
            throw new IllegalArgumentException(
                    "formetric.http.max-request-body-size must be between 1 byte and 262144 bytes");
        }
        this.maxBodyBytes = Math.toIntExact(configuredBytes);
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String method = request.getMethod();
        if ("GET".equalsIgnoreCase(method)
                || "HEAD".equalsIgnoreCase(method)
                || "OPTIONS".equalsIgnoreCase(method)
                || "TRACE".equalsIgnoreCase(method)) {
            return true;
        }

        String contentType = request.getContentType();
        if (contentType == null) {
            return false;
        }
        String normalizedContentType = contentType.toLowerCase(Locale.ROOT);
        return normalizedContentType.startsWith("multipart/")
                || normalizedContentType.startsWith(MediaType.APPLICATION_FORM_URLENCODED_VALUE);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        long declaredLength = request.getContentLengthLong();
        if (declaredLength > maxBodyBytes) {
            writePayloadTooLarge(response, request);
            return;
        }

        byte[] body;
        try {
            body = readLimited(request.getInputStream());
        } catch (RequestBodyTooLargeException exception) {
            writePayloadTooLarge(response, request);
            return;
        }

        filterChain.doFilter(new CachedBodyRequest(request, body), response);
    }

    private byte[] readLimited(ServletInputStream input) throws IOException, RequestBodyTooLargeException {
        ByteArrayOutputStream output = new ByteArrayOutputStream(Math.min(maxBodyBytes, READ_BUFFER_SIZE));
        byte[] buffer = new byte[READ_BUFFER_SIZE];

        while (true) {
            int remaining = maxBodyBytes - output.size();
            int bytesRead = input.read(buffer, 0, Math.min(buffer.length, remaining + 1));
            if (bytesRead == -1) {
                return output.toByteArray();
            }
            if (bytesRead > remaining) {
                throw new RequestBodyTooLargeException();
            }
            output.write(buffer, 0, bytesRead);
        }
    }

    private void writePayloadTooLarge(HttpServletResponse response, HttpServletRequest request) throws IOException {
        response.reset();
        response.setStatus(HttpStatus.PAYLOAD_TOO_LARGE.value());
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);

        Map<String, Object> problem = new LinkedHashMap<>();
        problem.put("type", "about:blank");
        problem.put("title", "Corpo da requisição muito grande");
        problem.put("status", HttpStatus.PAYLOAD_TOO_LARGE.value());
        problem.put("detail", "O corpo da requisição excede o limite permitido.");
        problem.put("instance", request.getRequestURI());
        problem.put("code", "REQUEST_BODY_TOO_LARGE");
        problem.put("maxBytes", maxBodyBytes);
        objectMapper.writeValue(response.getOutputStream(), problem);
    }

    private static final class CachedBodyRequest extends HttpServletRequestWrapper {

        private final byte[] body;

        private CachedBodyRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
        }

        @Override
        public ServletInputStream getInputStream() {
            return new CachedBodyServletInputStream(body);
        }

        @Override
        public BufferedReader getReader() {
            Charset charset = getCharacterEncoding() == null
                    ? StandardCharsets.UTF_8
                    : Charset.forName(getCharacterEncoding());
            return new BufferedReader(new InputStreamReader(getInputStream(), charset));
        }

        @Override
        public int getContentLength() {
            return body.length;
        }

        @Override
        public long getContentLengthLong() {
            return body.length;
        }
    }

    private static final class CachedBodyServletInputStream extends ServletInputStream {

        private final ByteArrayInputStream input;

        private CachedBodyServletInputStream(byte[] body) {
            this.input = new ByteArrayInputStream(body);
        }

        @Override
        public int read() {
            return input.read();
        }

        @Override
        public int read(byte[] bytes, int offset, int length) {
            return input.read(bytes, offset, length);
        }

        @Override
        public boolean isFinished() {
            return input.available() == 0;
        }

        @Override
        public boolean isReady() {
            return true;
        }

        @Override
        public void setReadListener(ReadListener readListener) {
            try {
                if (!isFinished()) {
                    readListener.onDataAvailable();
                }
                if (isFinished()) {
                    readListener.onAllDataRead();
                }
            } catch (IOException exception) {
                readListener.onError(exception);
            }
        }
    }

    private static final class RequestBodyTooLargeException extends Exception {
    }
}
