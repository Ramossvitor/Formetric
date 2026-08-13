package dev.formetric.diary;

import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** Builds a stable digest without retaining sensitive request payloads. */
final class DiaryIdempotencyFingerprint {

    private DiaryIdempotencyFingerprint() {}

    static String of(Object... components) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (Object component : components) {
                byte[] value = canonical(component).getBytes(StandardCharsets.UTF_8);
                digest.update(ByteBuffer.allocate(Integer.BYTES).putInt(value.length).array());
                digest.update(value);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 must be available", exception);
        }
    }

    private static String canonical(Object value) {
        if (value == null) {
            return "null:";
        }
        if (value instanceof BigDecimal decimal) {
            String normalized = decimal.signum() == 0 ? "0" : decimal.stripTrailingZeros().toPlainString();
            return "decimal:" + normalized;
        }
        if (value instanceof Enum<?> enumeration) {
            return "enum:" + enumeration.getDeclaringClass().getName() + ':' + enumeration.name();
        }
        return value.getClass().getName() + ':' + value;
    }
}
