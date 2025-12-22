const LanguageToggle = ({ language, onChange }) => {
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      <button
        type="button"
        className={language === "en" ? "chip active" : "chip"}
        onClick={() => onChange("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={language === "zh" ? "chip active" : "chip"}
        onClick={() => onChange("zh")}
      >
        中文
      </button>
    </div>
  );
};

export default LanguageToggle;
