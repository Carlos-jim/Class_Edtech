# --- Build ---
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY src src
RUN ./mvnw -B -q package -DskipTests

# --- Runtime: JRE y usuario sin privilegios ---
FROM eclipse-temurin:25-jre
RUN useradd --system --uid 1001 --no-create-home app
WORKDIR /app
COPY --from=build /app/target/tutor-backend-*.jar app.jar
USER app
EXPOSE 8080
# Opciones extra de la JVM por entorno: JAVA_TOOL_OPTIONS (p. ej. -Djava.net.preferIPv6Addresses=true solo en redes
# con IPv6 funcional; forzarlo sin IPv6 rompe las conexiones salientes a los proveedores de IA).
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
