package com.edtech.tutor.tutor.infra;

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
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Proveedor simulado y determinista: permite ejecutar la demo, los tests y la CI sin clave de API.
 *
 * <p>Busca en la lección la sección más relacionada con las palabras clave de la pregunta. Si ninguna coincide,
 * responde que no hay información suficiente ({@code grounded=false}), igual que el modelo real.
 *
 * <p>Si la pregunta contiene {@value #FAILURE_TRIGGER}, simula una caída del servicio de IA para demostrar la
 * recuperación de errores en la interfaz.
 */
@Component
@ConditionalOnProperty(name = "tutor.llm.provider", havingValue = "mock", matchIfMissing = true)
public class MockLlmAdapter implements LlmPort {

    public static final String FAILURE_TRIGGER = "#simular-fallo";

    private static final int MAX_ANSWER_CHARS = 700;
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
            return new TutorAnswer(
                    "No encuentro información suficiente en la lección «%s» para responder a esa pregunta. "
                            .formatted(lesson.title())
                            + "Puedo ayudarte con los temas que trata la lección; prueba a preguntar por alguno de sus apartados.",
                    false);
        }
        return new TutorAnswer("Según la lección «%s»: %s".formatted(lesson.title(), toPlainText(best.get().text())), true);
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

    private static String toPlainText(String markdownSection) {
        var text = CODE_BLOCK.matcher(markdownSection).replaceAll("");
        text = TABLE_ROW.matcher(text).replaceAll("");
        text = text.replaceAll("(?m)^#{1,6}\\s*", "")
                .replace("**", "")
                .replace("`", "")
                .replaceAll("(?m)^\\s*[-*]\\s+", "• ")
                .replaceAll("\\n{2,}", "\n")
                .strip();
        if (text.length() <= MAX_ANSWER_CHARS) {
            return text;
        }
        var cut = text.substring(0, MAX_ANSWER_CHARS);
        var lastSentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"));
        return (lastSentence > MAX_ANSWER_CHARS / 2 ? cut.substring(0, lastSentence + 1) : cut + "…").strip();
    }

    private static String normalize(String text) {
        return Normalizer.normalize(text.toLowerCase(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }
}
