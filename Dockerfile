# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS frontend-build

WORKDIR /workspace/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY frontend/ ./
RUN npm run build


FROM eclipse-temurin:24-jdk-alpine@sha256:8fdbcb6bc6b846640cea7058e6eeb56c311fae4efaa506a213789134065c6b90 AS backend-build

WORKDIR /workspace/backend

COPY backend/.mvn/ .mvn/
COPY backend/mvnw backend/pom.xml ./
RUN --mount=type=cache,target=/root/.m2 \
    chmod +x mvnw && \
    ./mvnw -B -ntp dependency:go-offline

COPY backend/src/ src/
COPY --from=frontend-build /workspace/frontend/dist/ src/main/resources/static/
RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw -B -ntp package -DskipTests


FROM eclipse-temurin:24-jre-alpine@sha256:4044b6c87cb088885bcd0220f7dc7a8a4aab76577605fa471945d2e98270741f AS runtime

# O digest congela os pacotes, não as CVEs descobertas depois; os pins abaixo corrigem base
# vulnerável sem esperar imagem nova (openssl 3.5.8-r0 cobre a CVE-2026-14456; libexpat 2.8.4-r0
# cobre a CVE-2026-66046 e a CVE-2026-76641).
RUN apk add --no-cache --upgrade \
        libexpat=2.8.4-r0 \
        p11-kit=0.26.2-r0 \
        p11-kit-trust=0.26.2-r0 \
        libcrypto3=3.5.8-r0 \
        libssl3=3.5.8-r0 \
        openssl=3.5.8-r0 && \
    addgroup -S formetric && \
    adduser -S -G formetric -h /app formetric

WORKDIR /app

COPY --from=backend-build --chown=formetric:formetric \
    /workspace/backend/target/formetric-api-*.jar app.jar

USER formetric

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
