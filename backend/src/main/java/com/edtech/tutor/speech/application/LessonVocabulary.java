package com.edtech.tutor.speech.application;

import com.edtech.tutor.catalog.Lesson;
import com.edtech.tutor.speech.domain.TranscriptionHint;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Extrae de la lección el vocabulario que puede aparecer en una pregunta: títulos de sección, términos en negrita,
 * código en línea ({@code GET /productos}, {@code 404 Not Found}) y siglas (API, HTTP, JSON). Determinista y sin IA.
 */
public final class LessonVocabulary {

    static final int MAX_TERMS = 40;
    private static final int MAX_TERM_LENGTH = 40;

    private static final Pattern HEADING = Pattern.compile("(?m)^#{1,3}\\s+(.+)$");
    private static final Pattern BOLD = Pattern.compile("\\*\\*([^*\\n]{2,60})\\*\\*");
    private static final Pattern INLINE_CODE = Pattern.compile("`([^`\\n]{2,60})`");
    private static final Pattern ACRONYM = Pattern.compile("\\b[A-ZÁÉÍÓÚÑ]{2,}\\b");

    private LessonVocabulary() {
    }

    public static TranscriptionHint from(Lesson lesson) {
        var content = lesson.getContent();
        var terms = new LinkedHashMap<String, String>(); // clave en minúsculas: sin duplicados, conserva el orden

        HEADING.matcher(content).results()
                .map(match -> match.group(1).split("\\s+[—–-]\\s+")[0])
                .forEach(term -> add(terms, term));
        BOLD.matcher(content).results().forEach(match -> add(terms, match.group(1)));
        INLINE_CODE.matcher(content).results().forEach(match -> add(terms, match.group(1)));
        ACRONYM.matcher(content).results().forEach(match -> add(terms, match.group()));

        var list = new ArrayList<>(terms.values());
        return new TranscriptionHint(lesson.getTitle(), list.size() > MAX_TERMS ? list.subList(0, MAX_TERMS) : List.copyOf(list));
    }

    private static void add(LinkedHashMap<String, String> terms, String raw) {
        var term = raw.replaceAll("[*`#]", "").replaceAll("\\s+", " ").strip();
        if (term.length() < 2 || term.length() > MAX_TERM_LENGTH || term.endsWith("?")) {
            return; // las preguntas de los títulos no son vocabulario
        }
        terms.putIfAbsent(term.toLowerCase(Locale.ROOT), term);
    }
}
