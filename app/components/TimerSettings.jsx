import { useEffect, useMemo, useState } from "react";

export default function TimerSettings({ initialEndDate, fetcher }) {
  const toInput = (str) => (str ? str.slice(0, 16) : "");

  const [value, setValue] = useState(() => {
    if (initialEndDate) return toInput(initialEndDate);
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });

  const [dirty, setDirty] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // зручно мати стабільний прапорець "щойно збережено"
  const justSaved = useMemo(
    () => fetcher.state === "idle" && fetcher.data?.ok === true,
    [fetcher.state, fetcher.data?.ok]
  );

  useEffect(() => {
    if (!justSaved) return;

    // якщо з бекенда прийшла дата — оновимо інпут
    if (fetcher.data?.endDate) {
      setValue(toInput(fetcher.data.endDate));
    }

    setDirty(false);
    setShowSaved(true);

    const t = setTimeout(() => setShowSaved(false), 2500);
    return () => clearTimeout(t);
  }, [justSaved, fetcher.data?.endDate]);

  // при первинному завантаженні з loader
  useEffect(() => {
    if (initialEndDate && !dirty) setValue(toInput(initialEndDate));
  }, [initialEndDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSubmitting = fetcher.state === "submitting";

  const now = new Date();
  const minVal = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  return (
    <>
      <s-section heading="Відлік до дати">
        <s-stack direction="block" gap="tight">
          <label>
            <s-paragraph>Дата і час завершення:</s-paragraph>
            <input
              type="datetime-local"
              name="endDate"
              value={value}
              min={minVal}
              onChange={(e) => {
                setValue(e.target.value);
                setDirty(true);
              }}
              style={{
                border: "1px solid #ccc",
                borderRadius: "6px",
                padding: "6px 10px",
                minWidth: "240px",
                marginTop: "4px",
              }}
            />
          </label>

          {dirty ? (
            <s-paragraph subdued style={{ color: "#e67e22" }}>
              Значення змінено — натисніть “Зберегти”.
            </s-paragraph>
          ) : (
            <s-paragraph subdued>Поточне збережене значення.</s-paragraph>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Дії" style={{ marginTop: 16 }}>
        <s-button variant="primary" submit disabled={!dirty || isSubmitting}>
          {isSubmitting ? "Зберігаю..." : "Зберегти"}
        </s-button>

        {showSaved && (
          <div style={{ marginTop: 8 }}>
            <s-paragraph subdued style={{ color: "green" }}>
              Дату оновлено.
            </s-paragraph>
          </div>
        )}

        <s-paragraph subdued>
          Збереження пише в metafield vtr.countdown_end.
        </s-paragraph>
      </s-section>
    </>
  );
}
