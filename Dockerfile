# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS frontend-build

WORKDIR /workspace/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY frontend/ ./
RUN npm run build


FROM eclipse-temurin:21-jdk-alpine AS backend-build

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


FROM eclipse-temurin:21-jre-alpine AS runtime

RUN addgroup -S formetric && \
    adduser -S -G formetric -h /app formetric

WORKDIR /app

COPY --from=backend-build --chown=formetric:formetric \
    /workspace/backend/target/formetric-api-*.jar app.jar

USER formetric

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
