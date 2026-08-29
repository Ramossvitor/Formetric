# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

# A imagem oficial do PostgreSQL garante um pg_dump na mesma major do servidor — um cliente
# mais antigo se recusa a exportar de um servidor 18. O upload usa a API JSON do Cloud
# Storage com o token do metadata server, então a CLI do gcloud não é necessária aqui.
FROM postgres:18-alpine@sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2

RUN apk add --no-cache curl openssl && \
    addgroup -S backup && \
    adduser -S -G backup -h /home/backup backup

COPY --chmod=0555 backup.sh /usr/local/bin/formetric-backup

USER backup

ENTRYPOINT ["/usr/local/bin/formetric-backup"]
