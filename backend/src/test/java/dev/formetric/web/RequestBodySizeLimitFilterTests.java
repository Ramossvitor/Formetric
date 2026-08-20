package dev.formetric.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.ServletContext;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.util.unit.DataSize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.ObjectMapper;

class RequestBodySizeLimitFilterTests {

    private static final int LIMIT_BYTES = 32;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        RequestBodySizeLimitFilter filter = new RequestBodySizeLimitFilter(
                DataSize.ofBytes(LIMIT_BYTES), new ObjectMapper());
        mockMvc = MockMvcBuilders.standaloneSetup(new BodyController())
                .addFilters(filter)
                .build();
    }

    @Test
    void rejectsDeclaredContentLengthBeforeReadingTheBody() throws Exception {
        mockMvc.perform(requestWithReportedLength("POST", "/body", "{}".getBytes(StandardCharsets.UTF_8),
                        LIMIT_BYTES + 1L))
                .andExpect(status().is(413))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("about:blank"))
                .andExpect(jsonPath("$.title").value("Corpo da requisição muito grande"))
                .andExpect(jsonPath("$.status").value(413))
                .andExpect(jsonPath("$.instance").value("/body"))
                .andExpect(jsonPath("$.code").value("REQUEST_BODY_TOO_LARGE"))
                .andExpect(jsonPath("$.maxBytes").value(LIMIT_BYTES));
    }

    @Test
    void rejectsChunkedBodyWhenReadingPastTheLimit() throws Exception {
        mockMvc.perform(requestWithReportedLength(
                        "POST", "/body", jsonPayloadOfSize(LIMIT_BYTES + 1), -1))
                .andExpect(status().is(413))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(413))
                .andExpect(jsonPath("$.code").value("REQUEST_BODY_TOO_LARGE"));
    }

    @Test
    void acceptsBodyAtTheExactByteLimit() throws Exception {
        mockMvc.perform(post("/body")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayloadOfSize(LIMIT_BYTES)))
                .andExpect(status().isNoContent())
                .andExpect(header().string("X-Body-Bytes", Integer.toString(LIMIT_BYTES)));
    }

    @Test
    void defaultsJsonReadersToUtf8WhenNoCharsetIsDeclared() throws Exception {
        String body = "{\"observacao\":\"ação\"}";

        mockMvc.perform(post("/reader")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body.getBytes(StandardCharsets.UTF_8)))
                .andExpect(status().isOk())
                .andExpect(content().encoding(StandardCharsets.UTF_8))
                .andExpect(content().string(body));
    }

    @Test
    void leavesGetRequestsAndEmptyBodiesUntouched() throws Exception {
        mockMvc.perform(requestWithReportedLength("GET", "/body", new byte[0], LIMIT_BYTES + 1L))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/body").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNoContent())
                .andExpect(header().string("X-Body-Bytes", "0"));
    }

    @Test
    void leavesMultipartRequestsToTheExistingMultipartLimits() throws Exception {
        mockMvc.perform(multipart("/multipart")
                        .file("file", jsonPayloadOfSize(LIMIT_BYTES + 1)))
                .andExpect(status().isNoContent());
    }

    @Test
    void rejectsUnsafeLimitConfigurationAndDocumentsTheHard256KibibyteCeiling() throws IOException {
        ObjectMapper objectMapper = new ObjectMapper();
        assertThatThrownBy(() -> new RequestBodySizeLimitFilter(DataSize.ofBytes(0), objectMapper))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must be between 1 byte");
        assertThatThrownBy(() -> new RequestBodySizeLimitFilter(
                        DataSize.ofBytes((256 * 1024L) + 1), objectMapper))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("262144 bytes");

        PropertySource<?> properties = new YamlPropertySourceLoader()
                .load("base", new ClassPathResource("application.yml"))
                .getFirst();
        assertThat(properties.getProperty("formetric.http.max-request-body-size"))
                .isEqualTo("${MAX_HTTP_REQUEST_BODY_SIZE:256KB}");
        assertThat(DataSize.parse("256KB").toBytes()).isEqualTo(256L * 1024);
    }

    private static byte[] jsonPayloadOfSize(int byteCount) {
        byte[] body = new byte[byteCount];
        Arrays.fill(body, (byte) 'a');
        body[0] = '"';
        body[body.length - 1] = '"';
        return body;
    }

    private static RequestBuilder requestWithReportedLength(
            String method, String path, byte[] body, long reportedLength) {
        return servletContext -> new LengthControlledRequest(
                servletContext, method, path, body, reportedLength);
    }

    private static final class LengthControlledRequest extends MockHttpServletRequest {

        private final long reportedLength;

        private LengthControlledRequest(
                ServletContext servletContext,
                String method,
                String path,
                byte[] body,
                long reportedLength) {
            super(servletContext);
            this.reportedLength = reportedLength;
            setMethod(method);
            setRequestURI(path);
            setContentType(MediaType.APPLICATION_JSON_VALUE);
            setContent(body);
            if (reportedLength < 0) {
                addHeader(HttpHeaders.TRANSFER_ENCODING, "chunked");
            }
        }

        @Override
        public int getContentLength() {
            return reportedLength > Integer.MAX_VALUE ? -1 : (int) reportedLength;
        }

        @Override
        public long getContentLengthLong() {
            return reportedLength;
        }

        @Override
        public String getHeader(String name) {
            if (HttpHeaders.CONTENT_LENGTH.equalsIgnoreCase(name)) {
                return reportedLength < 0 ? null : Long.toString(reportedLength);
            }
            return super.getHeader(name);
        }
    }

    @RestController
    private static final class BodyController {

        @PostMapping("/body")
        ResponseEntity<Void> body(HttpServletRequest request) throws IOException {
            int bodyBytes = request.getInputStream().readAllBytes().length;
            return ResponseEntity.noContent()
                    .header("X-Body-Bytes", Integer.toString(bodyBytes))
                    .build();
        }

        @GetMapping("/body")
        ResponseEntity<Void> getBody() {
            return ResponseEntity.noContent().build();
        }

        @PostMapping(value = "/reader", produces = MediaType.TEXT_PLAIN_VALUE)
        ResponseEntity<String> reader(HttpServletRequest request) throws IOException {
            return ResponseEntity.ok()
                    .contentType(new MediaType(MediaType.TEXT_PLAIN, StandardCharsets.UTF_8))
                    .body(request.getReader().readLine());
        }

        @PostMapping("/multipart")
        ResponseEntity<Void> multipart() {
            return ResponseEntity.noContent().build();
        }
    }
}
