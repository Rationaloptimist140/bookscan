"""
Comprehensive pytest test suite for bookscan/backend/triage_logic.py.

All tests are deterministic: year-dependent tests anchor against
the current date (2026) returned by datetime.datetime.now(), which
is monkey-patched where necessary so the suite does not drift over time.
"""

from __future__ import annotations

import datetime
import sys
import types
import unittest.mock as mock
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Make sure the backend package is importable regardless of cwd.
# ---------------------------------------------------------------------------
_BACKEND = Path(__file__).parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from triage_logic import (
    NICHE_DOMAINS,
    assess_ai_value,
    calculate_triage_score,
    clean_ocr_text,
    determine_public_domain,
    determine_triage_action,
    normalise_isbn,
    recommend_resale_platform,
    validate_isbn,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# The real current year as seen at import time (module uses datetime.datetime.now).
_REAL_CURRENT_YEAR = datetime.datetime.now(datetime.timezone.utc).year

# We fix CURRENT_YEAR = 2026 for all year-arithmetic tests so the test suite
# remains stable even if the repo outlives the year.
_FIXED_YEAR = 2026


def _fixed_now(*_args, **_kwargs):
    """Return a fixed UTC datetime anchored at 1 Jan 2026."""
    return datetime.datetime(_FIXED_YEAR, 1, 1, tzinfo=datetime.timezone.utc)


# Context manager that patches datetime.datetime.now inside triage_logic
def _patch_year():
    return mock.patch("triage_logic.datetime.datetime", wraps=datetime.datetime,
                      **{"now.side_effect": _fixed_now})


# ===========================================================================
# 1.  UK public domain rule  —  determine_public_domain
# ===========================================================================


class TestDeterminePublicDomain:
    """UK life+70 rule: PD when current_year > death_year + 70."""

    # --- death-year branch ---------------------------------------------------

    def test_died_exactly_70_years_ago_is_not_yet_pd(self):
        """
        death_year = 1956  →  pd_year = 2026
        current_year (2026) > pd_year (2026) is False  →  not_pd
        """
        with _patch_year():
            status, reason = determine_public_domain(None, _FIXED_YEAR - 70)
        assert status == "not_pd"
        assert "2026" in reason  # expiry year mentioned

    def test_died_71_years_ago_is_confirmed_pd(self):
        """
        death_year = 1955  →  pd_year = 2025
        2026 > 2025  →  confirmed_pd
        """
        with _patch_year():
            status, reason = determine_public_domain(None, _FIXED_YEAR - 71)
        assert status == "confirmed_pd"
        assert "1955" in reason

    def test_died_69_years_ago_is_not_pd(self):
        """
        death_year = 1957  →  pd_year = 2027
        2026 > 2027 is False  →  not_pd
        """
        with _patch_year():
            status, _ = determine_public_domain(None, _FIXED_YEAR - 69)
        assert status == "not_pd"

    def test_died_this_year_is_not_pd(self):
        """Author died this year — 70 years definitely hasn't elapsed."""
        with _patch_year():
            status, _ = determine_public_domain(None, _FIXED_YEAR)
        assert status == "not_pd"

    def test_died_200_years_ago_is_confirmed_pd(self):
        """Author died 200 years ago — unambiguously public domain."""
        with _patch_year():
            status, _ = determine_public_domain(None, _FIXED_YEAR - 200)
        assert status == "confirmed_pd"

    def test_death_year_takes_precedence_over_publish_year(self):
        """When both are supplied, death year governs (confirmed_pd expected)."""
        # death_year makes it PD; publish_year (post-1929) would give "unknown"
        with _patch_year():
            status, _ = determine_public_domain(2010, _FIXED_YEAR - 71)
        assert status == "confirmed_pd"

    # --- publish-year branch (no death year) --------------------------------

    def test_publish_year_before_1900_is_confirmed_pd(self):
        status, reason = determine_public_domain(1850, None)
        assert status == "confirmed_pd"
        assert "1850" in reason

    def test_publish_year_exactly_1899_is_confirmed_pd(self):
        """Boundary: 1899 < 1900  →  confirmed_pd."""
        status, _ = determine_public_domain(1899, None)
        assert status == "confirmed_pd"

    def test_publish_year_1900_is_likely_pd(self):
        """1900 is >= 1900 and < 1929  →  likely_pd."""
        status, reason = determine_public_domain(1900, None)
        assert status == "likely_pd"
        assert "1900" in reason

    def test_publish_year_1928_is_likely_pd(self):
        """1928 < 1929  →  likely_pd."""
        status, _ = determine_public_domain(1928, None)
        assert status == "likely_pd"

    def test_publish_year_1929_is_unknown(self):
        """1929 is NOT < 1929  →  unknown."""
        status, _ = determine_public_domain(1929, None)
        assert status == "unknown"

    def test_publish_year_2000_is_unknown(self):
        status, _ = determine_public_domain(2000, None)
        assert status == "unknown"

    def test_neither_publish_nor_death_year_is_unknown(self):
        status, reason = determine_public_domain(None, None)
        assert status == "unknown"
        assert "Insufficient" in reason


# ===========================================================================
# 2.  ISBN validation  —  validate_isbn / normalise_isbn
# ===========================================================================


class TestNormaliseIsbn:
    def test_strips_hyphens(self):
        assert normalise_isbn("978-0-14-043425-5") == "9780140434255"

    def test_strips_spaces(self):
        assert normalise_isbn("978 0 14 043425 5") == "9780140434255"

    def test_uppercases_x(self):
        assert normalise_isbn("080442957x") == "080442957X"

    def test_strips_mixed_hyphens_and_spaces(self):
        assert normalise_isbn("0-14-04342 5-9") == "0140434259"


class TestValidateIsbn:
    # --- valid cases ---------------------------------------------------------

    def test_valid_isbn10_standard(self):
        """0140434259 — classic valid ISBN-10."""
        assert validate_isbn("0140434259") is True

    def test_valid_isbn10_with_x_check_digit(self):
        """080442957X — valid ISBN-10 whose check digit is X."""
        assert validate_isbn("080442957X") is True

    def test_valid_isbn10_x_lowercase_accepted(self):
        """normalise_isbn uppercases x, so lowercase should also pass."""
        assert validate_isbn("080442957x") is True

    def test_valid_isbn10_with_hyphens(self):
        """Hyphens are stripped before validation."""
        assert validate_isbn("0-14-043425-9") is True

    def test_valid_isbn13(self):
        """9780140434255 — valid ISBN-13."""
        assert validate_isbn("9780140434255") is True

    def test_valid_isbn13_with_hyphens(self):
        assert validate_isbn("978-0-14-043425-5") is True

    # --- invalid cases -------------------------------------------------------

    def test_invalid_isbn10_wrong_checksum(self):
        """Flip the last digit to break the checksum."""
        assert validate_isbn("0140434250") is False

    def test_invalid_isbn13_wrong_checksum(self):
        """Flip the last digit."""
        assert validate_isbn("9780140434256") is False

    # --- malformed input -----------------------------------------------------

    def test_too_short(self):
        assert validate_isbn("123456789") is False  # 9 chars

    def test_too_long(self):
        assert validate_isbn("97801404342551") is False  # 14 chars

    def test_contains_letters_mid_string(self):
        assert validate_isbn("978014ABC4255") is False

    def test_empty_string(self):
        assert validate_isbn("") is False

    def test_none_like_string(self):
        """The function accepts str; passing the string 'None' should fail."""
        assert validate_isbn("None") is False

    def test_all_zeros_isbn10(self):
        """
        '0000000000' is actually a valid ISBN-10 by the checksum algorithm:
        sum(0 * weight for each position) = 0, and 0 % 11 == 0.
        The function correctly returns True — verify that behaviour.
        """
        assert validate_isbn("0000000000") is True


# ===========================================================================
# 3.  AI value assessment  —  assess_ai_value
# ===========================================================================


class TestAssessAiValueCore:
    """Core value tier logic."""

    def test_premium_pre2022_not_digitised_confirmed_pd(self):
        value, factors, pre_llm = assess_ai_value(1850, False, "confirmed_pd", [])
        assert value == "premium"
        assert pre_llm is True

    def test_premium_pre2022_not_digitised_likely_pd(self):
        value, _, _ = assess_ai_value(1920, False, "likely_pd", [])
        assert value == "premium"

    def test_high_pre2022_not_digitised_not_pd(self):
        value, _, _ = assess_ai_value(1970, False, "not_pd", [])
        assert value == "high"

    def test_high_pre2022_not_digitised_unknown_pd(self):
        value, _, _ = assess_ai_value(1970, False, "unknown", [])
        assert value == "high"

    def test_medium_pre2022_already_digitised(self):
        value, _, _ = assess_ai_value(1970, True, "confirmed_pd", [])
        assert value == "medium"

    def test_low_post_2022(self):
        value, _, _ = assess_ai_value(2023, False, "confirmed_pd", [])
        assert value == "low"

    def test_low_already_digitised_and_confirmed_pd_no_publish_year(self):
        """already_digitised + confirmed_pd with publish_year=None falls to 'low'."""
        value, _, _ = assess_ai_value(None, True, "confirmed_pd", [])
        assert value == "low"

    def test_unassessed_no_publish_year_not_digitised_copyrighted(self):
        """No publish year, not digitised, copyright → unassessed."""
        value, _, _ = assess_ai_value(None, False, "not_pd", [])
        assert value == "unassessed"


class TestAssessAiValuePreLlmFlag:
    """pre_llm is derived purely from publish_year vs 2022."""

    def test_publish_year_none_pre_llm_is_none(self):
        _, _, pre_llm = assess_ai_value(None, False, "unknown", [])
        assert pre_llm is None

    def test_publish_year_2021_pre_llm_is_true(self):
        _, _, pre_llm = assess_ai_value(2021, False, "unknown", [])
        assert pre_llm is True

    def test_publish_year_2022_pre_llm_is_false(self):
        """2022 is NOT strictly less than 2022."""
        _, _, pre_llm = assess_ai_value(2022, False, "unknown", [])
        assert pre_llm is False

    def test_publish_year_2023_pre_llm_is_false(self):
        _, _, pre_llm = assess_ai_value(2023, False, "unknown", [])
        assert pre_llm is False


class TestAssessAiValueFactors:
    """Factors list reflects input conditions."""

    def test_factors_include_pre_llm_era_for_old_book(self):
        _, factors, _ = assess_ai_value(1900, False, "confirmed_pd", [])
        assert any("pre-LLM" in f for f in factors)

    def test_factors_include_post_2022_risk_for_new_book(self):
        _, factors, _ = assess_ai_value(2023, False, "confirmed_pd", [])
        assert any("post-2022" in f for f in factors)

    def test_factors_include_pd_when_confirmed(self):
        _, factors, _ = assess_ai_value(1900, False, "confirmed_pd", [])
        assert any("public domain" in f for f in factors)

    def test_factors_include_copyright_when_not_pd(self):
        _, factors, _ = assess_ai_value(1970, False, "not_pd", [])
        assert any("copyrighted" in f for f in factors)

    def test_factors_include_not_digitised(self):
        _, factors, _ = assess_ai_value(1900, False, "confirmed_pd", [])
        assert any("not on Project Gutenberg" in f for f in factors)

    def test_factors_include_already_digitised(self):
        _, factors, _ = assess_ai_value(1900, True, "confirmed_pd", [])
        assert any("already on Project Gutenberg" in f for f in factors)


class TestAssessAiValueNicheDomains:
    """Niche domain detection populates factors correctly."""

    def test_botany_keyword_appears_in_factors(self):
        _, factors, _ = assess_ai_value(1900, False, "confirmed_pd", ["botany"])
        assert any("botany" in f for f in factors)

    def test_multiple_niche_domains_both_appear(self):
        _, factors, _ = assess_ai_value(1900, False, "confirmed_pd", ["medicine", "law"])
        niche_factors = [f for f in factors if "niche domain" in f]
        assert len(niche_factors) == 1
        combined = niche_factors[0]
        assert "medicine" in combined
        assert "law" in combined

    def test_no_niche_domain_no_niche_factor(self):
        _, factors, _ = assess_ai_value(1900, False, "confirmed_pd",
                                         ["cooking", "travel", "fiction"])
        assert not any("niche domain" in f for f in factors)

    def test_partial_keyword_match_triggers_domain(self):
        """
        The matching rule checks `d in kw` (domain string is a substring of the
        keyword string).  'botany' IS a substring of 'ethnobotany', so
        'ethnobotany' triggers the 'botany' domain.
        Note: 'mathematical' does NOT contain 'mathematics' as a substring
        (length 12 vs 11, and ends in 'al' not 'ics'), so that would not match.
        """
        _, factors, _ = assess_ai_value(1900, False, "confirmed_pd", ["ethnobotany"])
        assert any("botany" in f for f in factors)


# ===========================================================================
# 4.  Triage score  —  calculate_triage_score
# ===========================================================================


class TestCalculateTriageScore:
    """Each component contributes the documented amount; total caps at 100."""

    def test_maximum_score_premium_confirmed_pd_not_digitised_pre_llm(self):
        """40 + 25 + 20 + 15 = 100."""
        score = calculate_triage_score("premium", "confirmed_pd", False, True)
        assert score == 100

    def test_near_minimum_low_unknown_digitised_not_pre_llm(self):
        """5 + 0 + 0 + 0 = 5."""
        score = calculate_triage_score("low", "unknown", True, False)
        assert score == 5

    def test_true_minimum_none_ai_value_unknown_digitised_not_pre_llm(self):
        """
        ai_value not in lookup → 0; pd not in lookup → 0;
        digitised → 0; pre_llm False → 0.  Total = 0.
        """
        score = calculate_triage_score(None, "unknown", True, False)
        assert score == 0

    def test_score_caps_at_100(self):
        """premium(40) + confirmed_pd(25) + not_digitised(20) + pre_llm(15) = 100, capped."""
        score = calculate_triage_score("premium", "confirmed_pd", False, True)
        assert score <= 100

    # --- individual component checks ----------------------------------------

    @pytest.mark.parametrize("ai_value,expected_component", [
        ("premium", 40),
        ("high", 30),
        ("medium", 20),
        ("low", 5),
        ("unassessed", 0),
        (None, 0),
    ])
    def test_ai_value_component(self, ai_value, expected_component):
        """Isolate the ai_value contribution by zeroing all other components."""
        score = calculate_triage_score(ai_value, "not_pd", True, False)
        assert score == expected_component

    @pytest.mark.parametrize("pd_status,expected_component", [
        ("confirmed_pd", 25),
        ("likely_pd", 20),
        ("not_pd", 0),
        ("unknown", 0),
    ])
    def test_pd_status_component(self, pd_status, expected_component):
        """Isolate the pd_status contribution (no ai_value, digitised, not pre_llm)."""
        score = calculate_triage_score(None, pd_status, True, False)
        assert score == expected_component

    def test_not_digitised_adds_20(self):
        base = calculate_triage_score(None, "not_pd", True, False)   # 0
        with_nd = calculate_triage_score(None, "not_pd", False, False)  # 20
        assert with_nd - base == 20

    def test_pre_llm_adds_15(self):
        base = calculate_triage_score(None, "not_pd", True, False)   # 0
        with_pre = calculate_triage_score(None, "not_pd", True, True)   # 15
        assert with_pre - base == 15

    def test_pre_llm_none_adds_nothing(self):
        score_false = calculate_triage_score(None, "not_pd", True, False)
        score_none = calculate_triage_score(None, "not_pd", True, None)
        assert score_false == score_none == 0


# ===========================================================================
# 5.  Triage action  —  determine_triage_action
# ===========================================================================


class TestDetermineTriageAction:
    # --- already_available ---------------------------------------------------

    def test_already_available_digitised_confirmed_pd(self):
        action = determine_triage_action("premium", "confirmed_pd", True)
        assert action == "already_available"

    def test_already_available_digitised_likely_pd(self):
        action = determine_triage_action("high", "likely_pd", True)
        assert action == "already_available"

    def test_already_available_takes_priority_over_scan_and_sell(self):
        """Even premium value is trumped by already_available when digitised + PD."""
        action = determine_triage_action("premium", "confirmed_pd", True)
        assert action == "already_available"

    # --- scan_and_sell_data --------------------------------------------------

    def test_scan_and_sell_premium_confirmed_pd_not_digitised(self):
        action = determine_triage_action("premium", "confirmed_pd", False)
        assert action == "scan_and_sell_data"

    def test_scan_and_sell_high_likely_pd_not_digitised(self):
        action = determine_triage_action("high", "likely_pd", False)
        assert action == "scan_and_sell_data"

    # --- preserve_only -------------------------------------------------------

    def test_preserve_only_premium_not_pd(self):
        action = determine_triage_action("premium", "not_pd", False)
        assert action == "preserve_only"

    def test_preserve_only_high_not_pd(self):
        action = determine_triage_action("high", "not_pd", False)
        assert action == "preserve_only"

    # --- sell_physical -------------------------------------------------------

    def test_sell_physical_medium_value(self):
        action = determine_triage_action("medium", "unknown", False)
        assert action == "sell_physical"

    def test_sell_physical_low_value(self):
        action = determine_triage_action("low", "confirmed_pd", False)
        assert action == "sell_physical"

    # --- pending -------------------------------------------------------------

    def test_pending_unassessed_unknown_pd(self):
        action = determine_triage_action("unassessed", "unknown", False)
        assert action == "pending"

    def test_pending_none_value_unknown_pd(self):
        action = determine_triage_action(None, "unknown", False)
        assert action == "pending"


# ===========================================================================
# 6.  Resale platform recommendation  —  recommend_resale_platform
# ===========================================================================


class TestRecommendResalePlatform:
    """Verify platform routing and returned dict structure."""

    # --- routing -------------------------------------------------------------

    def test_premium_confirmed_pd_routes_to_abebooks(self):
        result = recommend_resale_platform("confirmed_pd", "premium", False)
        assert result["platform"] == "abebooks"

    def test_high_not_digitised_routes_to_abebooks(self):
        result = recommend_resale_platform("not_pd", "high", False)
        assert result["platform"] == "abebooks"

    def test_medium_routes_to_ebay(self):
        result = recommend_resale_platform("unknown", "medium", False)
        assert result["platform"] == "ebay"

    def test_low_routes_to_amazon_or_ziffit(self):
        result = recommend_resale_platform("unknown", "low", False)
        assert result["platform"] == "amazon_or_ziffit"

    def test_unassessed_routes_to_amazon_or_ziffit(self):
        """Falls through to the else branch."""
        result = recommend_resale_platform("unknown", "unassessed", False)
        assert result["platform"] == "amazon_or_ziffit"

    # --- returned dict structure ---------------------------------------------

    @pytest.mark.parametrize("pd_status,ai_value,digitised", [
        ("confirmed_pd", "premium", False),
        ("not_pd", "high", False),
        ("unknown", "medium", False),
        ("unknown", "low", False),
    ])
    def test_result_has_all_required_keys(self, pd_status, ai_value, digitised):
        result = recommend_resale_platform(pd_status, ai_value, digitised)
        assert "platform" in result
        assert "platform_label" in result
        assert "reason" in result
        assert "estimated_price_range" in result
        assert "listing_tips" in result

    def test_listing_tips_is_nonempty_list_of_strings_premium(self):
        result = recommend_resale_platform("confirmed_pd", "premium", False)
        tips = result["listing_tips"]
        assert isinstance(tips, list)
        assert len(tips) > 0
        assert all(isinstance(t, str) for t in tips)

    def test_listing_tips_is_nonempty_list_of_strings_ebay(self):
        result = recommend_resale_platform("unknown", "medium", False)
        tips = result["listing_tips"]
        assert isinstance(tips, list)
        assert len(tips) > 0
        assert all(isinstance(t, str) for t in tips)

    def test_estimated_price_range_is_string(self):
        result = recommend_resale_platform("confirmed_pd", "premium", False)
        assert isinstance(result["estimated_price_range"], str)
        assert len(result["estimated_price_range"]) > 0

    def test_platform_label_is_human_readable_string(self):
        result = recommend_resale_platform("confirmed_pd", "premium", False)
        assert result["platform_label"] == "AbeBooks"

    def test_platform_label_amazon_or_ziffit(self):
        result = recommend_resale_platform("unknown", "low", False)
        assert result["platform_label"] == "Amazon or Ziffit"


# ===========================================================================
# 7.  OCR text cleaning  —  clean_ocr_text
# ===========================================================================


class TestCleanOcrText:
    """Each test covers one transformation rule."""

    def test_excessive_whitespace_collapsed_to_single_space(self):
        result = clean_ocr_text("hello     world")
        assert result == "hello world"

    def test_multiple_spaces_within_sentence(self):
        result = clean_ocr_text("one  two   three    four")
        assert result == "one two three four"

    def test_multiple_newlines_collapsed_to_double_newline(self):
        result = clean_ocr_text("para one\n\n\n\npara two")
        assert result == "para one\n\npara two"

    def test_exactly_two_newlines_preserved_as_paragraph_break(self):
        result = clean_ocr_text("first\n\nsecond")
        assert result == "first\n\nsecond"

    def test_ligature_fi(self):
        result = clean_ocr_text("ﬁne")
        assert result == "fine"

    def test_ligature_fl(self):
        result = clean_ocr_text("ﬂow")
        assert result == "flow"

    def test_ligature_ff(self):
        result = clean_ocr_text("ﬀect")
        assert result == "ffect"

    def test_ligature_ffi(self):
        result = clean_ocr_text("eﬃcient")
        assert result == "efficient"

    def test_ligature_ffl(self):
        result = clean_ocr_text("ﬄuent")
        assert result == "ffluent"

    def test_smart_quotes_to_straight(self):
        result = clean_ocr_text("‘hello’")
        assert result == "'hello'"

    def test_smart_double_quotes_to_straight(self):
        result = clean_ocr_text("“hello”")
        assert result == '"hello"'

    def test_em_dash_preserved_with_spaces(self):
        """
        The code replaces — with ' — ' (space-em-dash-space).
        We test that the em dash character survives in the output.
        """
        result = clean_ocr_text("word—word")
        assert "—" in result

    def test_hyphenated_line_break_repaired(self):
        """'exam-\\nple' → 'example'."""
        result = clean_ocr_text("exam-\nple")
        assert result == "example"

    def test_hyphenated_line_break_with_spaces_repaired(self):
        """'hyphen-  \\n  ated' (extra spaces) also collapses correctly."""
        result = clean_ocr_text("hyphen-  \n  ated")
        assert result == "hyphenated"

    def test_leading_whitespace_stripped(self):
        result = clean_ocr_text("   hello world")
        assert not result.startswith(" ")

    def test_trailing_whitespace_stripped(self):
        result = clean_ocr_text("hello world   ")
        assert not result.endswith(" ")

    def test_leading_and_trailing_stripped(self):
        result = clean_ocr_text("  trimmed  ")
        assert result == "trimmed"

    def test_multiple_paragraphs_preserved(self):
        result = clean_ocr_text("para A\n\npara B\n\npara C")
        parts = result.split("\n\n")
        assert parts == ["para A", "para B", "para C"]

    def test_single_newline_within_paragraph_collapsed_to_space(self):
        """A single \n inside a paragraph should be treated as whitespace."""
        result = clean_ocr_text("line one\nline two")
        assert result == "line one line two"

    def test_empty_paragraphs_dropped(self):
        result = clean_ocr_text("first\n\n\n\nsecond")
        assert "\n\n\n" not in result
        assert result.count("\n\n") == 1


# ===========================================================================
# 8.  NICHE_DOMAINS tuple
# ===========================================================================


class TestNicheDomainsTuple:
    def test_has_exactly_14_entries(self):
        assert len(NICHE_DOMAINS) == 14

    @pytest.mark.parametrize("domain", [
        "botany",
        "medicine",
        "philosophy",
        "law",
        "navigation",
        "engineering",
        "chemistry",
        "astronomy",
        "agriculture",
        "history",
        "mathematics",
        "physics",
        "biology",
        "theology",
    ])
    def test_domain_present(self, domain):
        assert domain in NICHE_DOMAINS

    def test_is_a_tuple(self):
        assert isinstance(NICHE_DOMAINS, tuple)
