package com.edtech.tutor.tutor.infra;

import com.edtech.tutor.tutor.domain.LlmPort;
import com.edtech.tutor.tutor.domain.LlmUnavailableException;
import com.edtech.tutor.tutor.domain.TutorAnswer;
import com.edtech.tutor.tutor.domain.TutorPrompt;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.core.IntervalFunction;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import java.time.Duration;
import java.util.function.Supplier;

/**
 * Decorador que añade resiliencia a cualquier {@link LlmPort} sin modificarlo (patrón Decorator).
 * <ul>
 *   <li><b>Retry:</b> un reintento con backoff solo para fallos transitorios ({@link LlmUnavailableException#isRetryable()}).</li>
 *   <li><b>Circuit breaker:</b> si la mayoría de llamadas recientes fallan, deja de llamar al proveedor durante un
 *       tiempo y responde al instante con error, en lugar de hacer esperar al alumno hasta el timeout.</li>
 * </ul>
 * Los timeouts de conexión y lectura los aplica el cliente HTTP del adaptador.
 */
public final class ResilientLlmPort implements LlmPort {

    public static final RetryConfig DEFAULT_RETRY = RetryConfig.custom()
            .maxAttempts(2)
            .intervalFunction(IntervalFunction.ofExponentialBackoff(Duration.ofMillis(400), 2))
            .retryOnException(ex -> ex instanceof LlmUnavailableException llm && llm.isRetryable())
            .build();

    public static final CircuitBreakerConfig DEFAULT_CIRCUIT_BREAKER = CircuitBreakerConfig.custom()
            .slidingWindowSize(10)
            .minimumNumberOfCalls(4)
            .failureRateThreshold(50)
            .waitDurationInOpenState(Duration.ofSeconds(30))
            .permittedNumberOfCallsInHalfOpenState(1)
            .recordException(ex -> ex instanceof LlmUnavailableException)
            .build();

    private final LlmPort delegate;
    private final Retry retry;
    private final CircuitBreaker circuitBreaker;

    public ResilientLlmPort(LlmPort delegate, String name, RetryConfig retryConfig, CircuitBreakerConfig circuitBreakerConfig) {
        this.delegate = delegate;
        this.retry = Retry.of(name, retryConfig);
        this.circuitBreaker = CircuitBreaker.of(name, circuitBreakerConfig);
    }

    public static ResilientLlmPort withDefaults(LlmPort delegate, String name) {
        return new ResilientLlmPort(delegate, name, DEFAULT_RETRY, DEFAULT_CIRCUIT_BREAKER);
    }

    @Override
    public TutorAnswer answer(TutorPrompt prompt) {
        Supplier<TutorAnswer> call = CircuitBreaker.decorateSupplier(circuitBreaker, () -> delegate.answer(prompt));
        call = Retry.decorateSupplier(retry, call);
        try {
            return call.get();
        } catch (CallNotPermittedException ex) {
            throw LlmUnavailableException.permanent("Circuito abierto: el proveedor de IA ha fallado repetidamente", ex);
        }
    }

    CircuitBreaker.State circuitState() {
        return circuitBreaker.getState();
    }
}
