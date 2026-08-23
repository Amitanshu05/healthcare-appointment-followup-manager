# Stage 1: Build the application using Maven and JDK 21
FROM maven:3.9.6-eclipse-temurin-21-alpine AS build
WORKDIR /app

# Copy pom.xml and fetch dependencies to cache them
COPY pom.xml .
RUN mvn dependency:go-offline

# Copy sources and package the jar
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Lightweight runtime environment using JRE 21
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Copy the compiled jar from the build stage
COPY --from=build /app/target/backend-0.0.1-SNAPSHOT.jar app.jar

# Expose default Spring Boot port
EXPOSE 8080

# Start the application
ENTRYPOINT ["java", "-jar", "app.jar"]
