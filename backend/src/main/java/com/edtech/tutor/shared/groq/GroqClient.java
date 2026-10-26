package com.edtech.tutor.shared.groq;

import java.net.http.HttpClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** Cliente HTTP hacia Groq con timeouts explícitos y la clave en la cabecera. */
@Configuration
@EnableConfigurationProperties(GroqProperties.class)
public class GroqClient {

    public static final String MISSING_KEY_MESSAGE =
            "requiere GROQ_API_KEY: crea una clave gratuita en https://console.groq.com/keys y añádela a .env.";

    public static RestClient restClient(GroqProperties properties) {
        var httpClient = HttpClient.newBuilder().connectTimeout(properties.connectTimeout()).build();
        var requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.readTimeout());
        return RestClient.builder()
                .baseUrl(properties.baseUrl())
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.apiKey())
                .build();
    }
}
