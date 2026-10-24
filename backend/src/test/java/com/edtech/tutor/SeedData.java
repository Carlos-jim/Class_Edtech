package com.edtech.tutor;

import java.util.UUID;

/** IDs fijos de {@code db/seed/V2__demo_seed.sql}. */
public final class SeedData {

    public static final UUID ANA = UUID.fromString("a1b2c3d4-0000-4000-8000-000000000001");
    public static final UUID BRUNO = UUID.fromString("a1b2c3d4-0000-4000-8000-000000000002");
    public static final UUID COURSE = UUID.fromString("c0000000-0000-4000-8000-000000000001");
    public static final UUID LESSON_1 = UUID.fromString("e0000000-0000-4000-8000-000000000001");
    public static final UUID LESSON_2 = UUID.fromString("e0000000-0000-4000-8000-000000000002");

    private SeedData() {
    }
}
