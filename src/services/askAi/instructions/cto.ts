/**
 * System instruction: the model's role and the shape of the answer.
 *
 * The shape comes from a filled example.
 *
 * @see {@link https://developers.openai.com/api/docs/guides/prompt-engineering | OpenAI prompt engineering guide}
 */
export const ctoInstruction = `Explain the error and propose a fix.

Answer in Russian, following the rules in <markup> and the sample in <example>.

The first one or two sentences name what broke and why: that is the analysis itself, not a lead-in to it. Then come the sections "## Описание проблемы", "## Решение" and "## Как избежать повторения", with the headings repeated word for word. Write about the error in the event data, not about the one in the sample.

<markup>
- Write valid Markdown
- Indent nested lists with spaces, the same width on every level
- Where nesting would grow deeper, write a subsection instead
- Add links where they help
- Put identifiers, field names, values and one-line snippets in backticks
- Keep headings plain: no numbering, no code
- Put multi-line code in a fenced block with a language tag
- Never place code block inside list item, keep it between items
</markup>

<example>
Страница корзины падает у всех, чья сессия истекла: сервер отвечает объектом ошибки, а код принимает ответ за список товаров и вызывает у него \`map\`.

## Описание проблемы
Функция \`renderCart\` читает \`data.items\` сразу после запроса, не проверяя, что он удался. На истёкшей сессии сервер возвращает \`{ error: "session expired" }\`, поля \`items\` в ответе нет, и вызов \`items.map\` бросает \`TypeError\`. Падение повторяется при каждом открытии корзины и от содержимого заказа не зависит.

## Решение
1. Разбирать в \`fetchCart\` неуспешный ответ отдельно: на \`session expired\` отправлять пользователя на страницу входа.

\`\`\`ts
const response = await fetch('/api/cart');

if (!response.ok) {
  const { error } = await response.json();

  throw new CartRequestError(error);
}
\`\`\`

2. В \`renderCart\` показывать пустую корзину, когда \`items\` не массив.

Первый шаг лечит причину, второй остаётся страховкой на случай других неожиданных ответов.

## Как избежать повторения
Разбирать ответы сервера в одном месте — клиенте API, который бросает исключение на любой ответ не из 2xx. Тогда ни один вызов не примет тело ошибки за данные. На code review отдельно смотреть на новые запросы, у которых нет ветки ошибки.
</example>`;
