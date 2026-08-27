# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

# A imagem oficial do PostgreSQL garante um pg_dump na mesma major do servidor — um cliente
# mais antigo se recusa a exportar de um servidor 17. O upload usa a API JSON do Cloud
# Storage com o token do metadata server, então a CLI do gcloud não é necessária aqui.
FROM postgres:17-alpine@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73

RUN apk add --no-cache curl openssl && \
    addgroup -S backup && \
    adduser -S -G backup -h /home/backup backup

COPY --chmod=0555 backup.sh /usr/local/bin/formetric-backup

USER backup

ENTRYPOINT ["/usr/local/bin/formetric-backup"]
