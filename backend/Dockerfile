# --- Build ---
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY src src
RUN ./mvnw -B -q package -DskipTests

# --- Texto a voz local: Piper (MIT) + voz es_ES "davefx" (CC0) ---
# Lee las respuestas en voz alta cuando el navegador no tiene síntesis de voz. Sin claves ni servicios externos.
# Descargas fijadas por SHA-256: si el contenido cambiara, la construcción falla.
FROM alpine:3.20 AS piper
RUN apk add --no-cache curl
ARG TARGETARCH
ARG PIPER_RELEASE=https://github.com/rhasspy/piper/releases/download/2023.11.14-2
ARG VOICE_BASE=https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium
WORKDIR /opt/piper
RUN set -eu; \
    case "${TARGETARCH:-amd64}" in \
      amd64) asset=piper_linux_x86_64.tar.gz;  sum=a50cb45f355b7af1f6d758c1b360717877ba0a398cc8cbe6d2a7a3a26e225992 ;; \
      arm64) asset=piper_linux_aarch64.tar.gz; sum=fea0fd2d87c54dbc7078d0f878289f404bd4d6eea6e7444a77835d1537ab88eb ;; \
      *) echo "Arquitectura no soportada por Piper: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/piper.tgz "$PIPER_RELEASE/$asset"; \
    echo "$sum  /tmp/piper.tgz" | sha256sum -c -; \
    tar -xzf /tmp/piper.tgz --strip-components=1 -C /opt/piper; \
    mkdir voices; \
    curl -fsSL -o voices/es_ES-davefx-medium.onnx "$VOICE_BASE/es_ES-davefx-medium.onnx"; \
    curl -fsSL -o voices/es_ES-davefx-medium.onnx.json "$VOICE_BASE/es_ES-davefx-medium.onnx.json"; \
    echo "6658b03b1a6c316ee4c265a9896abc1393353c2d9e1bca7d66c2c442e222a917  voices/es_ES-davefx-medium.onnx" | sha256sum -c -; \
    echo "0e0dda87c732f6f38771ff274a6380d9252f327dca77aa2963d5fbdf9ec54842  voices/es_ES-davefx-medium.onnx.json" | sha256sum -c -; \
    rm /tmp/piper.tgz

# --- Runtime: JRE y usuario sin privilegios ---
FROM eclipse-temurin:25-jre
RUN useradd --system --uid 1001 --no-create-home app
WORKDIR /app
COPY --from=piper /opt/piper /opt/piper
COPY --from=build /app/target/tutor-backend-*.jar app.jar
ENV TTS_ENGINE=piper \
    PIPER_BINARY=/opt/piper/piper \
    PIPER_MODEL=/opt/piper/voices/es_ES-davefx-medium.onnx
USER app
EXPOSE 8080
# Opciones extra de la JVM por entorno: JAVA_TOOL_OPTIONS (p. ej. -Djava.net.preferIPv6Addresses=true solo en redes
# con IPv6 funcional; forzarlo sin IPv6 rompe las conexiones salientes a los proveedores de IA).
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
