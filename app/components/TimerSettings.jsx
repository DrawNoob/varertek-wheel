// app/components/TimerSettings.jsx
import { useEffect, useState } from "react";

export default function TimerSettings({ initialEndDate, fetcher }) {
  // приведемо бекову дату до формату для datetime-local
  const toInput = (str) => (str ? str.slice(0, 16) : "");

  const [value, setValue] = useState(() => {
    if (initialEndDate) return toInput(initialEndDate);
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });

  const [dirty, setDirty] = useState(false);

  // коли з action прийшла нова дата -> оновлюємо інпут і скидаємо dirty
  useEffect(() => {
    if (fetcher.data?.endDate) {
      setValue(toInput(fetcher.data.endDate));
      setDirty(false);
    } else if (initialEndDate) {
      setValue(toInput(initialEndDate));
      setDirty(false);
    }
  }, [fetcher.data, initialEndDate]);

  const isSubmitting = fetcher.state === "submitting";

  // мінімально допустиме
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
                setDirty(true); // ← тепер це точно в цьому ж компоненті
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
            <s-paragraph subdued>
              Поточне збережене значення.
            </s-paragraph>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Дії">
        <s-button
          variant="primary"
          submit
          disabled={!dirty || isSubmitting}
        >
          {isSubmitting ? "Зберігаю..." : "Зберегти"}
        </s-button>
        {fetcher.data?.ok && !dirty && (
          <s-paragraph subdued style={{ color: "green" }}>
            Успішно збережено.
          </s-paragraph>
        )}
        <s-paragraph subdued>
          Збереження пише в metafield vt.countdown_end.
        </s-paragraph>
      </s-section>
    </>
  );
}
