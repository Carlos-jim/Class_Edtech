package com.edtech.tutor.tutor.infra;

import com.edtech.tutor.tutor.application.CitationVerifier;
import com.edtech.tutor.tutor.domain.LlmPort;
import com.edtech.tutor.tutor.domain.LlmUnavailableException;
import com.edtech.tutor.tutor.domain.TutorAnswer;
import com.edtech.tutor.tutor.domain.TutorPrompt;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Proveedor simulado y determinista: permite ejecutar la demo, los tests y la CI sin clave de API.
 *
 * <p>Busca en la lección la sección más relacionada con las palabras clave de la pregunta. Si ninguna coincide,
 * responde que no hay información suficiente ({@code grounded=false}), igual que el modelo real. Si hay match,
 * incluye una {@code citation} literal tomada del texto de la lección.
 *
 * <p>Si la pregunta contiene {@value #FAILURE_TRIGGER}, simula una caída del servicio de IA para demostrar la
 * recuperación de errores en la interfaz.
 *
 * <p>Se registra como bean en {@link LlmConfig}.
 */
public class MockLlmAdapter implements LlmPort {

    public static final String FAILURE_TRIGGER = "#simular-fallo";

    private static final int MAX_ANSWER_CHARS = 700;
    private static final int MAX_CITATION_CHARS = 220;
    private static final Pattern SECTION_SPLIT = Pattern.compile("(?m)^(?=#{2,3} )");
    private static final Pattern CODE_BLOCK = Pattern.compile("(?s)```.*?```");
    private static final Pattern TABLE_ROW = Pattern.compile("(?m)^\\|.*\\|\\s*$\\n?");
    private static final Pattern NON_WORD = Pattern.compile("[^a-z0-9]+");

    private static final Set<String> STOPWORDS = Set.of(
            "que", "para", "por", "con", "los", "las", "del", "una", "uno", "unos", "unas", "como", "cual", "cuales",
            "cuando", "donde", "quien", "sirve", "sirven", "significa", "explica", "explicame", "puedes", "podrias",
            "dime", "quiero", "saber", "entre", "sobre", "este", "esta", "esto", "estos", "estas", "eso", "esa",
            "hay", "son", "ser", "muy", "mas", "pero", "sus", "les", "hace", "hacer", "tiene", "tienen", "porque",
            "diferencia", "leccion", "tutor", "ayuda", "the", "and");

    @Override
    public TutorAnswer answer(TutorPrompt prompt) {
        if (prompt.question().toLowerCase().contains(FAILURE_TRIGGER)) {
            throw new LlmUnavailableException("Fallo simulado del proveedor de IA (modo mock)");
        }

        var lesson = prompt.lesson();
        var keywords = keywords(prompt.question());
        var best = sections(lesson.content()).stream()
                .map(section -> new Scored(section, score(section, keywords)))
                .filter(scored -> scored.score() > 0)
                .max(Comparator.comparingInt(Scored::score));

        if (keywords.isEmpty() || best.isEmpty()) {
            return TutorAnswer.of(
                    "No encuentro información suficiente en la lección «%s» para responder a esa pregunta. "
                            .formatted(lesson.title())
                            + "Puedo ayudarte con los temas que trata la lección; prueba a preguntar por alguno de sus apartados.",
                    false);
        }
        var section = best.get().text();
        var citation = citationFrom(lesson.content(), section, keywords);
        return new TutorAnswer(
                "Según la lección «%s»: %s".formatted(lesson.title(), toPlainText(section)),
                true,
                citation);
    }

    private record Scored(String text, int score) {
    }

    static Set<String> keywords(String text) {
        return Arrays.stream(NON_WORD.split(normalize(text)))
                .filter(word -> word.length() >= 3 && !STOPWORDS.contains(word))
                .collect(Collectors.toSet());
    }

    /** Palabras distintas encontradas pesan más que las repeticiones. */
    private static int score(String section, Set<String> keywords) {
        var words = Arrays.asList(NON_WORD.split(normalize(section)));
        var distinct = keywords.stream().filter(words::contains).count();
        var occurrences = words.stream().filter(keywords::contains).count();
        return (int) (distinct * 10 + occurrences);
    }

    private static List<String> sections(String markdown) {
        return Arrays.stream(SECTION_SPLIT.split(markdown)).map(String::strip).filter(s -> !s.isEmpty()).toList();
    }

    /**
     * Elige un trozo contiguo del markdown original de la lección (para que {@link CitationVerifier} lo acepte).
     * Conserva negritas, cursivas y código, como hace el modelo real al citar literalmente.
     */
    static String citationFrom(String lessonContent, String section, Set<String> keywords) {
        var plain = toPlainText(section);
        for (var sentence : toQuotableMarkdown(section).split("(?<=\\.\\s)|(?<=\\n)")) {
            var candidate = sentence.strip();
            if (candidate.length() >= CitationVerifier.MIN_CITATION_CHARS
                    && CitationVerifier.normalize(lessonContent).contains(CitationVerifier.normalize(candidate))) {
                return truncate(candidate, MAX_CITATION_CHARS);
            }
        }
        // Ancla en la primera keyword encontrada en el texto crudo de la lección
        for (var keyword : keywords) {
            var idx = indexOfNormalized(lessonContent, keyword);
            if (idx >= 0) {
                var start = Math.max(0, idx - 30);
                var end = Math.min(lessonContent.length(), idx + MAX_CITATION_CHARS);
                while (start > 0 && !Character.isWhitespace(lessonContent.charAt(start - 1))) {
                    start--;
                }
                while (end < lessonContent.length() && !Character.isWhitespace(lessonContent.charAt(end))) {
                    end++;
                }
                var slice = lessonContent.substring(start, end).strip();
                slice = slice.replaceAll("^#+\\s*", "");
                if (slice.length() >= CitationVerifier.MIN_CITATION_CHARS) {
                    return truncate(slice, MAX_CITATION_CHARS);
                }
            }
        }
        return truncate(plain, MAX_CITATION_CHARS);
    }

    private static int indexOfNormalized(String haystack, String needle) {
        var h = CitationVerifier.normalize(haystack);
        var n = CitationVerifier.normalize(needle);
        var at = h.indexOf(n);
        if (at < 0) {
            return -1;
        }
        // Aproximación: misma posición relativa en el texto original
        var ratio = haystack.length() == 0 ? 0 : (double) at / Math.max(h.length(), 1);
        return Math.min(haystack.length() - 1, (int) (ratio * haystack.length()));
    }

    /** Prosa de la sección con su formato en línea: sin bloques de código, tablas ni marcas de título. */
    private static String toQuotableMarkdown(String markdownSection) {
        var text = CODE_BLOCK.matcher(markdownSection).replaceAll("");
        text = TABLE_ROW.matcher(text).replaceAll("");
        return text.replaceAll("(?m)^#{1,6}\\s*", "").replaceAll("\\n{2,}", "\n").strip();
    }

    private static String toPlainText(String markdownSection) {
        var text = CODE_BLOCK.matcher(markdownSection).replaceAll("");
        text = TABLE_ROW.matcher(text).replaceAll("");
        text = text.replaceAll("(?m)^#{1,6}\\s*", "")
                .replace("**", "")
                .replace("`", "")
                .replaceAll("(?m)^\\s*[-*]\\s+", "• ")
                .replaceAll("\\n{2,}", "\n")
                .strip();
        return truncate(text, MAX_ANSWER_CHARS);
    }

    private static String truncate(String text, int max) {
        if (text.length() <= max) {
            return text;
        }
        var cut = text.substring(0, max);
        var lastSentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"));
        return (lastSentence > max / 2 ? cut.substring(0, lastSentence + 1) : cut + "…").strip();
    }

    private static String normalize(String text) {
        return Normalizer.normalize(text.toLowerCase(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }
}
