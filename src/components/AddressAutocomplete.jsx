import { useEffect, useRef, useState } from "react";
import { searchLocations } from "../services/oneMap.js";
import UiIcon from "./UiIcon.jsx";

const MIN_QUERY_LENGTH = 2;
const SEARCH_DELAY_MS = 220;
const EMPTY_SAVED_LOCATIONS = [];

const normalizeSuggestionText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const isExactSuggestionMatch = (query, suggestion) => {
  const normalizedQuery = normalizeSuggestionText(query);
  return [suggestion.value, suggestion.address].some(
    (value) => normalizeSuggestionText(value) === normalizedQuery
  );
};

const getSavedLocationSuggestions = (savedLocations, query) => {
  const normalizedQuery = normalizeSuggestionText(query);
  if (!normalizedQuery) {
    return [];
  }

  return savedLocations
    .filter((location) => {
      const name = normalizeSuggestionText(location.name);
      const value = normalizeSuggestionText(location.value);
      return name.includes(normalizedQuery) || value.includes(normalizedQuery);
    })
    .map((location) => ({
      id: `saved-${location.id}`,
      label: location.name,
      address: location.value,
      value: location.value,
      isSaved: true
    }));
};

const dedupeAutocompleteSuggestions = (suggestions) => {
  const seen = new Set();
  return suggestions.filter((suggestion) => {
    const key = normalizeSuggestionText(suggestion.value || suggestion.address || suggestion.label);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const AddressAutocomplete = ({
  id,
  value,
  onChange,
  onSelect,
  placeholder,
  ariaLabel,
  savedLocations = EMPTY_SAVED_LOCATIONS,
  inputClassName = "",
  wrapperClassName = "",
  showUseCurrent = false,
  onUseCurrent,
  isUsingCurrent = false,
  t
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const query = value.trim();
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setIsLoading(false);
      setActiveIndex(-1);
      return undefined;
    }

    setIsLoading(true);
    const timerId = window.setTimeout(async () => {
      const savedSuggestions = getSavedLocationSuggestions(savedLocations, query);
      const oneMapSuggestions = await searchLocations(query);
      if (requestId !== requestIdRef.current) {
        return;
      }
      const results = dedupeAutocompleteSuggestions([...savedSuggestions, ...oneMapSuggestions]);
      const hasExactMatch = results.some((suggestion) => isExactSuggestionMatch(query, suggestion));
      const visibleResults = hasExactMatch ? [] : results;
      setSuggestions(visibleResults);
      setIsOpen(visibleResults.length > 0);
      setIsLoading(false);
      setActiveIndex(visibleResults.length ? 0 : -1);
    }, SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [savedLocations, value]);

  const handleSelect = (suggestion) => {
    onChange(suggestion.value);
    onSelect?.(suggestion);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event) => {
    if (!isOpen || !suggestions.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className={["location-autocomplete", wrapperClassName].filter(Boolean).join(" ")}>
      <div className="location-input-row">
        <input
          id={id}
          className={inputClassName}
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder={placeholder}
          aria-label={ariaLabel || placeholder}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => {
            if (suggestions.length) {
              setIsOpen(true);
            }
          }}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 120);
          }}
          onKeyDown={handleKeyDown}
        />
        {showUseCurrent && (
          <button
            type="button"
            className="use-current-button"
            onClick={() => onUseCurrent?.()}
            disabled={isUsingCurrent}
            aria-label={t ? t("currentLocationLabel") : "Current location"}
          >
            <UiIcon name={isUsingCurrent ? "time" : "navigation"} />
          </button>
        )}
      </div>
      {isOpen && suggestions.length > 0 && (
        <div className="suggestion-list" role="listbox" aria-label={t("suggestionsLabel")}>
          {suggestions.map((suggestion, index) => (
            <button
              type="button"
              className={index === activeIndex ? "suggestion-item active" : "suggestion-item"}
              key={suggestion.id}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(suggestion)}
            >
              <span className="suggestion-title">{suggestion.label}</span>
              <span className="suggestion-address">{suggestion.address}</span>
            </button>
          ))}
        </div>
      )}
      {isLoading && value.trim().length >= MIN_QUERY_LENGTH && (
        <span className="suggestion-loading">{t("suggestionsLoading")}</span>
      )}
    </div>
  );
};

export default AddressAutocomplete;
