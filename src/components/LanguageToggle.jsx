const LanguageToggle = ({ language, onChange, label = "Language" }) => {
  return (
    <div className="lang-toggle" role="group" aria-label={label}>
      <button
        type="button"
        className={language === "en" ? "lang-option active" : "lang-option"}
        onClick={() => onChange("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={language === "zh" ? "lang-option active" : "lang-option"}
        onClick={() => onChange("zh")}
      >
        中文
      </button>
    </div>
  );
};

export default LanguageToggle;
