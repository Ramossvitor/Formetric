# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS frontend-build

WORKDIR /workspace/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY frontend/ ./
RUN npm run build


FROM eclipse-temurin:25-jdk-alpine@sha256:5ecfde8e5ecde5954ea3721155b345ef56c1d579b940c761318ad4c05959a151 AS backend-build

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


FROM eclipse-temurin:25-jre-alpine@sha256:28db6fdf60e38945e43d840c0333aeaec66c15943070104f7586fd3c9d1665b0 AS runtime

RUN apk add --no-cache --upgrade \
        libexpat=2.8.3-r0 \
        p11-kit=0.26.2-r0 \
        p11-kit-trust=0.26.2-r0 && \
    addgroup -S formetric && \
    adduser -S -G formetric -h /app formetric

WORKDIR /app

COPY --from=backend-build --chown=formetric:formetric \
    /workspace/backend/target/formetric-api-*.jar app.jar

USER formetric

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
