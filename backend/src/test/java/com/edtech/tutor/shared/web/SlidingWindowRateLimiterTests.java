package com.edtech.tutor.shared.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class SlidingWindowRateLimiterTests {

    /** Reloj manual para controlar el tiempo en el test. */
    static final class MutableClock extends Clock {
        Instant now = Instant.parse("2026-10-24T10:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }
    }

    final MutableClock clock = new MutableClock();
    final SlidingWindowRateLimiter limiter = new SlidingWindowRateLimiter(3, Duration.ofMinutes(1), clock);

    @Test
    void allowsUpToTheLimitWithinTheWindowAndTellsWhenToRetry() {
        assertThat(limiter.tryAcquire("a").allowed()).isTrue();
        clock.advance(Duration.ofSeconds(10));
        assertThat(limiter.tryAcquire("a").allowed()).isTrue();
        assertThat(limiter.tryAcquire("a").allowed()).isTrue();

        var rejected = limiter.tryAcquire("a");

        assertThat(rejected.allowed()).isFalse();
        assertThat(rejected.retryAfterSeconds()).isBetween(50L, 51L);
    }

    @Test
    void windowSlidesSoOldRequestsStopCounting() {
        for (int i = 0; i < 3; i++) {
            limiter.tryAcquire("a");
        }
        clock.advance(Duration.ofSeconds(61));

        assertThat(limiter.tryAcquire("a").allowed()).isTrue();
    }

    @Test
    void keysAreIndependent() {
        for (int i = 0; i < 3; i++) {
            limiter.tryAcquire("ana");
        }

        assertThat(limiter.tryAcquire("ana").allowed()).isFalse();
        assertThat(limiter.tryAcquire("carla").allowed()).isTrue();
    }

    @Test
    void idleKeysAreEvicted() {
        limiter.tryAcquire("a");
        limiter.tryAcquire("b");
        clock.advance(Duration.ofMinutes(2));
        limiter.tryAcquire("b");

        limiter.evictIdle();

        assertThat(limiter.trackedKeys()).isEqualTo(1);
    }
}
