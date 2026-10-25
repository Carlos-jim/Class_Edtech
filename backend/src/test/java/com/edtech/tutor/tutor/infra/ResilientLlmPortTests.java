package com.edtech.tutor.tutor.infra;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.edtech.tutor.tutor.domain.LlmPort;
import com.edtech.tutor.tutor.domain.LlmUnavailableException;
import com.edtech.tutor.tutor.domain.TutorAnswer;
import com.edtech.tutor.tutor.domain.TutorPrompt;
import com.edtech.tutor.tutor.domain.TutorPrompt.LessonContext;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.core.IntervalFunction;
import io.github.resilience4j.retry.RetryConfig;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

class ResilientLlmPortTests {

    static final TutorPrompt PROMPT = new TutorPrompt("s", List.of(), "q", new LessonContext("t", "c"));
    static final TutorAnswer OK = TutorAnswer.of("respuesta", true);

    /** Mismas reglas que producción, pero sin esperas para que el test sea rápido. */
    static final RetryConfig FAST_RETRY = RetryConfig.from(ResilientLlmPort.DEFAULT_RETRY)
            .intervalFunction(IntervalFunction.of(Duration.ofMillis(1)))
            .build();

    @Test
    void transientFailureIsRetriedOnceAndThenSucceeds() {
        var fake = new ScriptedLlm(() -> { throw LlmUnavailableException.retryable("timeout", null); }, () -> OK);
        var port = new ResilientLlmPort(fake, "t1", FAST_RETRY, ResilientLlmPort.DEFAULT_CIRCUIT_BREAKER);

        assertThat(port.answer(PROMPT)).isEqualTo(OK);
        assertThat(fake.calls).isEqualTo(2);
    }

    @Test
    void retriesAreLimitedToTwoAttempts() {
        var fake = new ScriptedLlm(() -> { throw LlmUnavailableException.retryable("5xx", null); });
        var port = new ResilientLlmPort(fake, "t2", FAST_RETRY, ResilientLlmPort.DEFAULT_CIRCUIT_BREAKER);

        assertThatThrownBy(() -> port.answer(PROMPT)).isInstanceOf(LlmUnavailableException.class);
        assertThat(fake.calls).isEqualTo(2);
    }

    @Test
    void permanentFailureIsNotRetried() {
        var fake = new ScriptedLlm(() -> { throw LlmUnavailableException.permanent("401", null); });
        var port = new ResilientLlmPort(fake, "t3", FAST_RETRY, ResilientLlmPort.DEFAULT_CIRCUIT_BREAKER);

        assertThatThrownBy(() -> port.answer(PROMPT)).isInstanceOf(LlmUnavailableException.class);
        assertThat(fake.calls).isEqualTo(1);
    }

    @Test
    void circuitOpensAfterRepeatedFailuresAndFailsFastWithoutCallingTheProvider() {
        var fake = new ScriptedLlm(() -> { throw LlmUnavailableException.permanent("caído", null); });
        var port = new ResilientLlmPort(fake, "t4", FAST_RETRY, ResilientLlmPort.DEFAULT_CIRCUIT_BREAKER);

        for (int i = 0; i < 4; i++) {
            assertThatThrownBy(() -> port.answer(PROMPT)).isInstanceOf(LlmUnavailableException.class);
        }
        assertThat(port.circuitState()).isEqualTo(CircuitBreaker.State.OPEN);
        var callsBefore = fake.calls;

        assertThatThrownBy(() -> port.answer(PROMPT))
                .isInstanceOf(LlmUnavailableException.class)
                .hasMessageContaining("Circuito abierto");
        assertThat(fake.calls).isEqualTo(callsBefore);
    }

    @Test
    void circuitRecoversAfterWaitWhenProviderIsBack() throws Exception {
        var breaker = CircuitBreakerConfig.from(ResilientLlmPort.DEFAULT_CIRCUIT_BREAKER)
                .waitDurationInOpenState(Duration.ofMillis(50))
                .build();
        Supplier<TutorAnswer> fail = () -> { throw LlmUnavailableException.permanent("caído", null); };
        var fake = new ScriptedLlm(fail, fail, fail, fail, () -> OK);
        var port = new ResilientLlmPort(fake, "t5", FAST_RETRY, breaker);
        for (int i = 0; i < 4; i++) {
            assertThatThrownBy(() -> port.answer(PROMPT)).isInstanceOf(LlmUnavailableException.class);
        }

        Thread.sleep(80);

        assertThat(port.answer(PROMPT)).isEqualTo(OK);
        assertThat(port.circuitState()).isEqualTo(CircuitBreaker.State.CLOSED);
    }

    /** LLM falso que ejecuta un guion de respuestas; repite la última cuando se agota. */
    static final class ScriptedLlm implements LlmPort {

        private final Deque<Supplier<TutorAnswer>> script;
        private Supplier<TutorAnswer> last;
        int calls;

        @SafeVarargs
        ScriptedLlm(Supplier<TutorAnswer>... steps) {
            this.script = new ArrayDeque<>(List.of(steps));
        }

        @Override
        public TutorAnswer answer(TutorPrompt prompt) {
            calls++;
            if (!script.isEmpty()) {
                last = script.poll();
            }
            return last.get();
        }
    }
}
