export function validationClass(
  hasValue: boolean,
  isValid: boolean,
  touched: boolean,
  submitted: boolean,
) {
  if (isValid && hasValue) return "field-valid";
  if (!isValid && (touched || submitted)) return "field-invalid";
  return "";
}

export function focusFirstInvalidField(form: HTMLFormElement | null) {
  if (!form) return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const invalid = form.querySelector<HTMLElement>(
        '[aria-invalid="true"], [data-invalid="true"] input, [data-invalid="true"] select, [data-invalid="true"] textarea, [data-invalid="true"] button',
      );
      if (!invalid) return;
      const field = invalid.closest<HTMLElement>("label, fieldset, [data-field-group]") ?? invalid;
      field.scrollIntoView({ behavior: "smooth", block: "center" });
      invalid.focus({ preventScroll: true });
    });
  });
}
