package com.edtech.tutor.shared.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.edtech.tutor.shared.ai.Hedging.HedgeException;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

class HedgingTests {

    static final Duration STAGGER = Duration.ofMillis(100);
    static final Duration DEADLINE = Duration.ofSeconds(2);

    /** Intento que responde tras {@code delayMs}; cuenta cuántas veces se lanzó y si lo interrumpieron. */
    static final class Attempt implements Supplier<String> {
        final String value;
        final long delayMs;
        final RuntimeException error;
        final AtomicInteger calls = new AtomicInteger();
        final CountDownLatch interrupted = new CountDownLatch(1);

        Attempt(String value, long delayMs) {
            this(value, delayMs, null);
        }

        Attempt(String value, long delayMs, RuntimeException error) {
            this.value = value;
            this.delayMs = delayMs;
            this.error = error;
        }

        @Override
        public String get() {
            calls.incrementAndGet();
            try {
                Thread.sleep(delayMs);
            } catch (InterruptedException ex) {
                interrupted.countDown();
                throw new IllegalStateException("cancelado");
            }
            if (error != null) {
                throw error;
            }
            return value;
        }
    }

    @Test
    void aFastFirstAttemptWinsWithoutLaunchingTheOthers() {
        var first = new Attempt("primero", 10);
        var second = new Attempt("segundo", 10);

        assertThat(Hedging.race(List.of(first, second), STAGGER, DEADLINE)).isEqualTo("primero");
        assertThat(second.calls).hasValue(0);
    }

    @Test
    void aSlowAttemptGetsAHedgeAndTheFirstAnswerWinsAndTheLoserIsCancelled() throws Exception {
        var slow = new Attempt("lento", 1_500);
        var fast = new Attempt("rápido", 50);
        var start = System.nanoTime();

        assertThat(Hedging.race(List.of(slow, fast), STAGGER, DEADLINE)).isEqualTo("rápido");

        var elapsed = Duration.ofNanos(System.nanoTime() - start);
        assertThat(elapsed).isLessThan(Duration.ofMillis(800)); // ~stagger + 50 ms, no los 1,5 s del lento
        assertThat(slow.interrupted.await(1, TimeUnit.SECONDS)).as("el intento lento se cancela").isTrue();
    }

    @Test
    void aFailureLaunchesTheNextAttemptImmediately() {
        var failing = new Attempt(null, 5, new IllegalStateException("503"));
        var ok = new Attempt("ok", 5);
        var start = System.nanoTime();

        assertThat(Hedging.race(List.of(failing, ok), Duration.ofSeconds(1), DEADLINE)).isEqualTo("ok");
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofMillis(500)); // sin esperar el stagger
    }

    @Test
    void whenEveryAttemptFailsAllFailuresAreReported() {
        var a = new Attempt(null, 5, new IllegalStateException("a"));
        var b = new Attempt(null, 5, new IllegalStateException("b"));

        assertThatThrownBy(() -> Hedging.race(List.of(a, b), STAGGER, DEADLINE))
                .isInstanceOf(HedgeException.class)
                .satisfies(ex -> {
                    var hedge = (HedgeException) ex;
                    assertThat(hedge.failures()).hasSize(2);
                    assertThat(hedge.deadlineExceeded()).isFalse();
                });
    }

    @Test
    void theDeadlineBoundsTheTotalWait() {
        var a = new Attempt("a", 5_000);
        var b = new Attempt("b", 5_000);
        var start = System.nanoTime();

        assertThatThrownBy(() -> Hedging.race(List.of(a, b), STAGGER, Duration.ofMillis(400)))
                .isInstanceOf(HedgeException.class)
                .satisfies(ex -> assertThat(((HedgeException) ex).deadlineExceeded()).isTrue());
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(2));
    }
}
