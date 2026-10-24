package com.edtech.tutor.shared.web;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limitador en memoria de ventana deslizante: como mucho {@code limit} peticiones por clave en {@code window}.
 * Suficiente para una instancia (POC); con varias réplicas se usaría un almacén compartido (Redis).
 */
public final class SlidingWindowRateLimiter {

    public record Decision(boolean allowed, long retryAfterSeconds) {
    }

    private final int limit;
    private final Duration window;
    private final Clock clock;
    private final ConcurrentHashMap<String, Deque<Instant>> hits = new ConcurrentHashMap<>();

    public SlidingWindowRateLimiter(int limit, Duration window, Clock clock) {
        if (limit <= 0 || window.isNegative() || window.isZero()) {
            throw new IllegalArgumentException("El límite y la ventana deben ser positivos");
        }
        this.limit = limit;
        this.window = window;
        this.clock = clock;
    }

    public Decision tryAcquire(String key) {
        var now = clock.instant();
        var decision = new Decision[1];
        hits.compute(key, (k, timestamps) -> {
            var queue = timestamps == null ? new ArrayDeque<Instant>() : timestamps;
            prune(queue, now.minus(window));
            if (queue.size() < limit) {
                queue.addLast(now);
                decision[0] = new Decision(true, 0);
            } else {
                var retryAfter = Duration.between(now, queue.peekFirst().plus(window)).toSeconds() + 1;
                decision[0] = new Decision(false, Math.max(1, retryAfter));
            }
            return queue;
        });
        return decision[0];
    }

    /** Elimina claves sin actividad reciente (evita crecer sin límite). Atómico por clave. */
    public void evictIdle() {
        var cutoff = clock.instant().minus(window);
        for (var key : hits.keySet()) {
            hits.computeIfPresent(key, (k, queue) -> {
                prune(queue, cutoff);
                return queue.isEmpty() ? null : queue;
            });
        }
    }

    private static void prune(Deque<Instant> queue, Instant cutoff) {
        while (!queue.isEmpty() && !queue.peekFirst().isAfter(cutoff)) {
            queue.pollFirst();
        }
    }

    int trackedKeys() {
        return hits.size();
    }
}
