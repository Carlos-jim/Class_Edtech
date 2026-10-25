package com.edtech.tutor.tutor.application;

import com.edtech.tutor.tutor.domain.TutorAnswer;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Comprueba que la cita alegada por el modelo aparece en la lección.
 *
 * <p>Si el modelo marca {@code grounded=true} pero no aporta una cita verificable, se degrada a
 * {@code grounded=false} y se descarta la cita. Así el indicador de la UI no depende solo del LLM.
 */
@Component
public class CitationVerifier {

    public static final int MIN_CITATION_CHARS = 24;
    private static final double MIN_WORD_COVERAGE = 0.85;
    private static final Pattern MARKDOWN_NOISE = Pattern.compile("[*_`#\\[\\]()>|~]+");
    private static final Pattern NON_WORD = Pattern.compile("[^a-z0-9]+");

    public TutorAnswer verify(TutorAnswer raw, String lessonContent) {
        if (!raw.grounded()) {
            return TutorAnswer.of(raw.answer(), false);
        }
        var citation = raw.citation();
        if (citation == null || citation.length() < MIN_CITATION_CHARS) {
            return demote(raw.answer());
        }
        if (appearsInLesson(lessonContent, citation)) {
            return new TutorAnswer(raw.answer(), true, citation);
        }
        return demote(raw.answer());
    }

    /** {@code true} si la cita (normalizada) está en la lección o casi todas sus palabras aparecen en orden. */
    public boolean appearsInLesson(String lessonContent, String citation) {
        var lesson = normalize(lessonContent);
        var quote = normalize(citation);
        if (quote.length() < MIN_CITATION_CHARS || lesson.isBlank()) {
            return false;
        }
        if (lesson.contains(quote)) {
            return true;
        }
        return orderedWordCoverage(lesson, quote) >= MIN_WORD_COVERAGE;
    }

    private static TutorAnswer demote(String answer) {
        return TutorAnswer.of(answer, false);
    }

    /** Normaliza para comparar citas ignorando mayúsculas, acentos y ruido de Markdown. */
    public static String normalize(String text) {
        var n = Normalizer.normalize(text.toLowerCase(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        n = MARKDOWN_NOISE.matcher(n).replaceAll(" ");
        n = NON_WORD.matcher(n).replaceAll(" ");
        return n.replaceAll("\\s+", " ").strip();
    }

    /** Fracción de palabras significativas de la cita que aparecen en orden en la lección. */
    static double orderedWordCoverage(String lessonNorm, String citationNorm) {
        var words = Arrays.stream(citationNorm.split(" "))
                .filter(w -> w.length() >= 3)
                .toList();
        if (words.size() < 4) {
            return 0;
        }
        int pos = 0;
        int matched = 0;
        for (var word : words) {
            int found = lessonNorm.indexOf(word, pos);
            if (found >= 0) {
                matched++;
                pos = found + word.length();
            }
        }
        return (double) matched / words.size();
    }
}
