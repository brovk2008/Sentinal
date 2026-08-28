"""
shap_explainer.py — Sentinal SHAP Feature Explainability Layer

Wraps sklearn TreeExplainer (or LinearExplainer as fallback) around all
prediction models to generate per-prediction feature attribution scores.

For each hotspot / reoffend / resolution prediction, the explainer:
  1. Computes SHAP values for the input feature vector
  2. Maps feature indices to human-readable labels
  3. Returns top-N contributing features with direction (+/-) and magnitude
  4. Optionally synthesizes a narrative explanation via GLM

SHAP is loaded lazily (not at container startup) to preserve AppSail boot time.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional, Any
import numpy as np

log = logging.getLogger(__name__)


# ─── Human-readable feature label maps ───────────────────────────────────────

HOTSPOT_FEATURE_LABELS = {
    "PoliceStationID":    "Police Station ID",
    "month":              "Month of Year",
    "case_count":         "Recent Cases (Last 30 Days)",
    "avg_gravity":        "Average Crime Severity",
    "unique_crime_types": "Crime Type Diversity",
    "avg_accused":        "Average Accused per Case",
    "total_amount":       "Total Suspicious Financial Amount",
    "avg_calls":          "Average CDR Calls per Case",
    "is_weekend_rate":    "Weekend Crime Rate",
}

REOFFEND_FEATURE_LABELS = {
    "total_cases":           "Total Prior Cases",
    "crime_type_diversity":  "Crime Category Spread",
    "avg_gravity":           "Average Severity of Prior Crimes",
    "arrest_count":          "Times Arrested",
    "chargesheet_count":     "Times Chargesheeted",
    "age":                   "Age of Accused",
    "cases_per_year":        "Cases per Year (Activity Rate)",
    "escaped_chargesheet":   "Previously Escaped Chargesheet",
}

RESOLUTION_FEATURE_LABELS = {
    "GravityOffenceID":  "Crime Severity",
    "CrimeMajorHeadID":  "Crime Category",
    "CaseCategoryID":    "Case Category",
    "accused_count":     "Number of Accused",
    "victim_count":      "Number of Victims",
    "arrest_count":      "Arrests Made",
    "has_arrest":        "At Least One Arrest Made",
    "month_registered":  "Month Case Registered",
}


# ─── Data Classes ─────────────────────────────────────────────────────────────

@dataclass
class FeatureContribution:
    feature_name: str
    human_label: str
    shap_value: float
    feature_value: Any
    direction: str           # "+" increases risk, "-" decreases risk
    contribution_pct: float  # Percentage of total absolute attribution


@dataclass
class ShapExplanation:
    model_type: str          # "hotspot" | "reoffend" | "resolution"
    predicted_value: float
    top_features: list[FeatureContribution] = field(default_factory=list)
    narrative: str = ""
    shap_available: bool = True


# ─── ShapExplainer ────────────────────────────────────────────────────────────

class ShapExplainer:

    def __init__(self):
        self._explainers: dict[str, Any] = {}   # model_name → shap.Explainer
        self._shap_available = False
        self._try_import_shap()

    def _try_import_shap(self):
        try:
            import shap  # noqa
            self._shap_available = True
            log.info("[SHAP] shap library available.")
        except ImportError:
            log.info("[SHAP] shap not installed — using fallback feature importance from model.")

    def _get_explainer(self, model_name: str, model):
        """
        Lazily build and cache a SHAP explainer for a given model.
        Uses TreeExplainer for tree-based models (RF, GBM), LinearExplainer fallback.
        """
        if model_name in self._explainers:
            return self._explainers[model_name]

        if not self._shap_available:
            return None

        import shap
        try:
            # Try TreeExplainer first (RandomForest, GradientBoosting, etc.)
            explainer = shap.TreeExplainer(model)
            log.info(f"[SHAP] TreeExplainer built for model: {model_name}")
        except Exception:
            try:
                explainer = shap.LinearExplainer(model, masker=shap.maskers.Independent(np.zeros((1, 9))))
                log.info(f"[SHAP] LinearExplainer built for model: {model_name}")
            except Exception as e:
                log.warning(f"[SHAP] Could not build explainer for {model_name}: {e}")
                return None

        self._explainers[model_name] = explainer
        return explainer

    # ── Public API ────────────────────────────────────────────────────────────

    def explain_hotspot(
        self, model, features_df, predicted_prob: float
    ) -> ShapExplanation:
        return self._explain(
            model_name="hotspot",
            model=model,
            features_df=features_df,
            label_map=HOTSPOT_FEATURE_LABELS,
            predicted_value=predicted_prob,
            model_type="hotspot",
        )

    def explain_reoffend(
        self, model, features_df, predicted_prob: float
    ) -> ShapExplanation:
        return self._explain(
            model_name="reoffend",
            model=model,
            features_df=features_df,
            label_map=REOFFEND_FEATURE_LABELS,
            predicted_value=predicted_prob,
            model_type="reoffend",
        )

    def explain_resolution(
        self, model, features_df, predicted_prob: float
    ) -> ShapExplanation:
        return self._explain(
            model_name="resolution",
            model=model,
            features_df=features_df,
            label_map=RESOLUTION_FEATURE_LABELS,
            predicted_value=predicted_prob,
            model_type="resolution",
        )

    def _explain(
        self,
        model_name: str,
        model,
        features_df,
        label_map: dict,
        predicted_value: float,
        model_type: str,
        top_n: int = 4,
    ) -> ShapExplanation:
        """
        Core explanation method. Computes SHAP values or falls back to
        model feature importances if SHAP is not available.
        """
        feature_names = list(features_df.columns)
        feature_values = features_df.iloc[0].to_dict()

        # ── SHAP path ──────────────────────────────────────────────────────
        if self._shap_available:
            explainer = self._get_explainer(model_name, model)
            if explainer is not None:
                try:
                    import shap
                    import numpy as np
                    shap_values = explainer.shap_values(features_df)

                    if hasattr(shap_values, "values"):
                        shap_vals_arr = shap_values.values
                    else:
                        shap_vals_arr = shap_values

                    if isinstance(shap_vals_arr, list):
                        shap_vals_arr = shap_vals_arr[1] if len(shap_vals_arr) > 1 else shap_vals_arr[0]

                    shap_vals_arr = np.atleast_2d(shap_vals_arr)
                    if shap_vals_arr.ndim == 3:
                        sv = shap_vals_arr[0, :, 1] if shap_vals_arr.shape[2] > 1 else shap_vals_arr[0, :, 0]
                    else:
                        sv = shap_vals_arr[0]

                    contributions = self._build_contributions(
                        sv, feature_names, feature_values, label_map
                    )
                    top = sorted(contributions, key=lambda c: abs(c.shap_value), reverse=True)[:top_n]
                    return ShapExplanation(
                        model_type=model_type,
                        predicted_value=predicted_value,
                        top_features=top,
                        narrative=self._build_narrative(model_type, predicted_value, top),
                        shap_available=True,
                    )
                except Exception as e:
                    log.warning(f"[SHAP] shap_values computation failed for {model_name}: {e}")

        # ── Fallback: model feature importances ────────────────────────────
        return self._fallback_explain(
            model, feature_names, feature_values, label_map, predicted_value, model_type, top_n
        )

    def _build_contributions(
        self,
        shap_vals: np.ndarray,
        feature_names: list[str],
        feature_values: dict,
        label_map: dict,
    ) -> list[FeatureContribution]:
        total_abs = float(np.sum(np.abs(shap_vals))) or 1.0
        contribs = []
        for i, fname in enumerate(feature_names):
            sv = float(shap_vals[i])
            contribs.append(FeatureContribution(
                feature_name=fname,
                human_label=label_map.get(fname, fname.replace("_", " ").title()),
                shap_value=round(sv, 5),
                feature_value=feature_values.get(fname),
                direction="+" if sv > 0 else "-",
                contribution_pct=round(abs(sv) / total_abs * 100, 1),
            ))
        return contribs

    def _fallback_explain(
        self,
        model,
        feature_names: list[str],
        feature_values: dict,
        label_map: dict,
        predicted_value: float,
        model_type: str,
        top_n: int,
    ) -> ShapExplanation:
        """
        Fallback when SHAP is not available.
        Uses model.feature_importances_ if available (sklearn tree models).
        """
        importances = None
        try:
            # For sklearn Pipeline or ensemble, dig into the final estimator
            est = model
            if hasattr(model, "named_steps"):
                est = list(model.named_steps.values())[-1]
            if hasattr(est, "feature_importances_"):
                importances = est.feature_importances_
        except Exception:
            pass

        if importances is None or len(importances) != len(feature_names):
            # Final fallback: all features equal weight
            importances = np.ones(len(feature_names)) / len(feature_names)

        total_imp = float(np.sum(importances)) or 1.0
        contribs = []
        for i, fname in enumerate(feature_names):
            imp = float(importances[i])
            # Estimate direction from feature value vs median (heuristic)
            fval = feature_values.get(fname, 0) or 0
            direction = "+" if fval > 0 else "-"
            contribs.append(FeatureContribution(
                feature_name=fname,
                human_label=label_map.get(fname, fname.replace("_", " ").title()),
                shap_value=round(imp, 5),
                feature_value=fval,
                direction=direction,
                contribution_pct=round(imp / total_imp * 100, 1),
            ))

        top = sorted(contribs, key=lambda c: c.contribution_pct, reverse=True)[:top_n]
        return ShapExplanation(
            model_type=model_type,
            predicted_value=predicted_value,
            top_features=top,
            narrative=self._build_narrative(model_type, predicted_value, top),
            shap_available=False,
        )

    def _build_narrative(
        self, model_type: str, predicted_value: float, top: list[FeatureContribution]
    ) -> str:
        """
        Synthesize a concise natural-language explanation from top SHAP features.
        No LLM call needed — template-based for zero latency.
        """
        pct = round(predicted_value * 100, 1)
        if model_type == "hotspot":
            subject = f"This zone is flagged with {pct}% crime hotspot probability"
        elif model_type == "reoffend":
            subject = f"This accused has a {pct}% recidivism risk score"
        else:
            subject = f"This case has a {pct}% prediction score"

        if not top:
            return f"{subject}. Insufficient feature data for detailed attribution."

        parts = []
        for f in top[:3]:
            direction_word = "primarily driven by" if f == top[0] else "further elevated by" if f.direction == "+" else "partially offset by"
            parts.append(f"{direction_word} **{f.human_label}** (value: {f.feature_value}, contribution: {f.contribution_pct}%)")

        return f"{subject}, {', '.join(parts)}."

    def to_dict(self, explanation: ShapExplanation) -> dict:
        """Serialize ShapExplanation to a JSON-safe dict for API responses."""
        return {
            "model_type": explanation.model_type,
            "predicted_value": explanation.predicted_value,
            "shap_available": explanation.shap_available,
            "narrative": explanation.narrative,
            "top_factors": [
                {
                    "feature": f.human_label,
                    "value": f.feature_value,
                    "direction": f.direction,
                    "contribution_pct": f"{'+'if f.direction=='+' else ''}{f.contribution_pct}%",
                    "shap_value": f.shap_value,
                }
                for f in explanation.top_features
            ],
        }


# ─── Singleton ────────────────────────────────────────────────────────────────
_explainer: Optional[ShapExplainer] = None

def get_explainer() -> ShapExplainer:
    global _explainer
    if _explainer is None:
        _explainer = ShapExplainer()
    return _explainer
