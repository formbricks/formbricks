// This schema maps to the `feedback_records` table owned by the Formbricks Hub Postgres.
// If the Hub changes column names or types, this schema must be updated to match.
cube(`FeedbackRecords`, {
  sql: `SELECT * FROM feedback_records`,

  measures: {
    count: {
      type: `count`,
      description: `Total number of feedback responses`,
    },

    uniqueRespondents: {
      type: `countDistinct`,
      sql: `${CUBE}.user_id`,
      description: `Number of unique users who provided feedback`,
    },

    uniqueResponses: {
      type: `countDistinct`,
      sql: `${CUBE}.submission_id`,
      description: `Number of unique survey submissions (a submission can produce multiple feedback records)`,
    },

    promoterCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.field_type = 'nps' AND ${CUBE}.value_number >= 9` }],
      description: `Number of NPS promoters (score 9-10)`,
    },

    detractorCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.field_type = 'nps' AND ${CUBE}.value_number BETWEEN 0 AND 6` }],
      description: `Number of NPS detractors (score 0-6)`,
    },

    passiveCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.field_type = 'nps' AND ${CUBE}.value_number BETWEEN 7 AND 8` }],
      description: `Number of NPS passives (score 7-8)`,
    },

    npsScore: {
      type: `number`,
      sql: `
        CASE
          WHEN COUNT(CASE WHEN ${CUBE}.field_type = 'nps' AND ${CUBE}.value_number IS NOT NULL THEN 1 END) = 0 THEN NULL
          ELSE ROUND(
            (
              (COUNT(CASE WHEN ${CUBE}.field_type = 'nps' AND ${CUBE}.value_number >= 9 THEN 1 END)::numeric -
               COUNT(CASE WHEN ${CUBE}.field_type = 'nps' AND ${CUBE}.value_number BETWEEN 0 AND 6 THEN 1 END)::numeric)
              / COUNT(CASE WHEN ${CUBE}.field_type = 'nps' AND ${CUBE}.value_number IS NOT NULL THEN 1 END)::numeric
            ) * 100,
            2
          )
        END
      `,
      description: `Net Promoter Score: ((Promoters - Detractors) / Answered NPS responses) * 100. NULL when there are no answered NPS responses.`,
    },

    npsAverage: {
      type: `avg`,
      sql: `${CUBE}.value_number`,
      filters: [{ sql: `${CUBE}.field_type = 'nps'` }],
      description: `Average NPS rating (0-10)`,
    },

    csatCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.field_type = 'csat' AND ${CUBE}.value_number IS NOT NULL` }],
      description: `Number of answered CSAT responses (dismissed responses excluded).`,
    },

    csatSatisfiedCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.field_type = 'csat' AND ${CUBE}.value_number >= 4` }],
      description: `Number of satisfied CSAT responses (top-2-box on the 1-5 scale)`,
    },

    csatDissatisfiedCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.field_type = 'csat' AND ${CUBE}.value_number BETWEEN 1 AND 2` }],
      description: `Number of dissatisfied CSAT responses (bottom-2-box on the 1-5 scale)`,
    },

    csatNeutralCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.field_type = 'csat' AND ${CUBE}.value_number = 3` }],
      description: `Number of neutral CSAT responses (middle box on the 1-5 scale)`,
    },

    csatScore: {
      type: `number`,
      sql: `
        CASE
          WHEN COUNT(CASE WHEN ${CUBE}.field_type = 'csat' AND ${CUBE}.value_number IS NOT NULL THEN 1 END) = 0 THEN NULL
          ELSE ROUND(
            (
              COUNT(CASE WHEN ${CUBE}.field_type = 'csat' AND ${CUBE}.value_number >= 4 THEN 1 END)::numeric
              / COUNT(CASE WHEN ${CUBE}.field_type = 'csat' AND ${CUBE}.value_number IS NOT NULL THEN 1 END)::numeric
            ) * 100,
            2
          )
        END
      `,
      description: `CSAT Score: % of answered CSAT responses rated 4 or 5 (top-2-box on the 1-5 scale). NULL when there are no answered CSAT responses.`,
    },

    csatAverage: {
      type: `avg`,
      sql: `${CUBE}.value_number`,
      filters: [{ sql: `${CUBE}.field_type = 'csat'` }],
      description: `Average CSAT rating (1-5)`,
    },

    cesCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.field_type = 'ces' AND ${CUBE}.value_number IS NOT NULL` }],
      description: `Number of answered CES responses (dismissed responses excluded).`,
    },

    cesAverage: {
      type: `avg`,
      sql: `${CUBE}.value_number`,
      filters: [{ sql: `${CUBE}.field_type = 'ces'` }],
      description: `Average CES rating (scale is 1-5 or 1-7 depending on the question)`,
    },

    ratingCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.field_type = 'rating' AND ${CUBE}.value_number IS NOT NULL` }],
      description: `Number of answered rating responses (dismissed responses excluded).`,
    },

    ratingAverage: {
      type: `avg`,
      sql: `${CUBE}.value_number`,
      filters: [{ sql: `${CUBE}.field_type = 'rating'` }],
      description: `Average rating value (scale depends on the question, e.g. 1-5 or 1-10)`,
    },

    sentimentAverage: {
      type: `avg`,
      sql: `${CUBE}.sentiment_score`,
      description: `Average sentiment score (-1 to 1, negative to positive). Only enriched records count; "mixed" records score near 0 and are included.`,
    },

    // Emotion counts: a record carries 0..6 emotions (multi-label), so these
    // counts are not mutually exclusive and can sum to more than the record count.
    joyCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.emotions @> ARRAY['joy']::text[]` }],
      description: `Number of feedback records tagged with the "joy" emotion`,
    },

    angerCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.emotions @> ARRAY['anger']::text[]` }],
      description: `Number of feedback records tagged with the "anger" emotion`,
    },

    sadnessCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.emotions @> ARRAY['sadness']::text[]` }],
      description: `Number of feedback records tagged with the "sadness" emotion`,
    },

    fearCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.emotions @> ARRAY['fear']::text[]` }],
      description: `Number of feedback records tagged with the "fear" emotion`,
    },

    surpriseCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.emotions @> ARRAY['surprise']::text[]` }],
      description: `Number of feedback records tagged with the "surprise" emotion`,
    },

    disgustCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.emotions @> ARRAY['disgust']::text[]` }],
      description: `Number of feedback records tagged with the "disgust" emotion`,
    },

    // Sentiment label counts: sentiment is a single-value column (not multi-label), so unlike the
    // emotion counts these ARE mutually exclusive — they partition the enriched records and sum to
    // the enriched record count. NULL (not-yet-enriched) records fall into none of them.
    veryNegativeCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.sentiment = 'very_negative'` }],
      description: `Number of feedback records with "very_negative" sentiment`,
    },

    negativeCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.sentiment = 'negative'` }],
      description: `Number of feedback records with "negative" sentiment`,
    },

    neutralCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.sentiment = 'neutral'` }],
      description: `Number of feedback records with "neutral" sentiment`,
    },

    positiveCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.sentiment = 'positive'` }],
      description: `Number of feedback records with "positive" sentiment`,
    },

    veryPositiveCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.sentiment = 'very_positive'` }],
      description: `Number of feedback records with "very_positive" sentiment`,
    },

    mixedCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.sentiment = 'mixed'` }],
      description: `Number of feedback records with "mixed" sentiment`,
    },
  },

  dimensions: {
    id: {
      sql: `id`,
      type: `string`,
      primaryKey: true,
    },

    sourceType: {
      sql: `source_type`,
      type: `string`,
      description: `Source type of the feedback (e.g., nps_campaign, survey)`,
    },

    sourceName: {
      sql: `source_name`,
      type: `string`,
      description: `Human-readable name of the source`,
    },

    sourceId: {
      sql: `source_id`,
      type: `string`,
      description: `Stable id of the source (e.g. the survey id). Group/filter to disambiguate sources with the same name.`,
    },

    fieldType: {
      sql: `field_type`,
      type: `string`,
      description: `Type of feedback field (e.g., nps, text, rating)`,
    },

    fieldLabel: {
      sql: `field_label`,
      type: `string`,
      description: `Human-readable label of the question/field (e.g., "How satisfied are you with support?")`,
    },

    fieldId: {
      sql: `field_id`,
      type: `string`,
      description: `Stable identifier of the question/field (the source survey element id). Unlike fieldLabel it does not change across languages or when the label is edited, so group/filter by this to keep identical or translated labels as one question.`,
    },

    fieldGroupLabel: {
      sql: `field_group_label`,
      type: `string`,
      description: `Label of the parent composite question for matrix/ranking rows`,
    },

    language: {
      sql: `language`,
      type: `string`,
      description: `Response language code (e.g., "en", "de"). NULL when language is "default".`,
    },

    // ── Hub enrichment fields ─────────────────────────────────────────────────
    // Server-generated by the Hub enrichment workers (migrations 014/015); NULL
    // until a record is enriched. Values are machine-generated lowercase tokens.
    sentiment: {
      sql: `sentiment`,
      type: `string`,
      description: `Sentiment label from Hub enrichment: very_negative, negative, neutral, positive, very_positive, or mixed. NULL until enriched.`,
    },

    sentimentScore: {
      sql: `sentiment_score`,
      type: `number`,
      description: `Signed sentiment polarity score (-1 to 1), set together with the sentiment label. NULL until enriched.`,
    },

    emotions: {
      sql: `ARRAY_TO_STRING(${CUBE}.emotions, ', ')`,
      type: `string`,
      description: `Detected emotions as a comma-separated multi-label set from: joy, anger, sadness, fear, surprise, disgust. NULL when not enriched or no emotion was detected. Filter a single emotion with "contains".`,
    },

    collectedAt: {
      sql: `collected_at`,
      type: `time`,
      description: `Timestamp when the feedback was collected`,
    },

    createdAt: {
      sql: `created_at`,
      type: `time`,
      description: `Timestamp when the feedback record was created in Hub`,
    },

    updatedAt: {
      sql: `updated_at`,
      type: `time`,
      description: `Timestamp when the feedback record was last updated in Hub`,
    },

    valueNumber: {
      sql: `value_number`,
      type: `number`,
      description: `Numeric answer value (NPS 0-10, CSAT 1-5, CES 1-5 or 1-7, rating, generic number). Pair with a fieldType filter to keep scales consistent.`,
    },

    valueText: {
      sql: `value_text`,
      type: `string`,
      description: `Text answer value (open text, or the label of a multiple-choice / categorical answer). Pair with a fieldType filter to keep types consistent.`,
    },

    valueId: {
      sql: `value_id`,
      type: `string`,
      description: `Stable id of a selected choice (single/multi-select). Group by this instead of valueText to consolidate the same option across languages / after a label edit.`,
    },

    valueBoolean: {
      sql: `value_boolean`,
      type: `boolean`,
      description: `Boolean answer value (yes/no questions). Pair with a fieldType filter.`,
    },

    valueDate: {
      sql: `value_date`,
      type: `time`,
      description: `Date answer value (e.g., "preferred meeting date"). Pair with a fieldType filter.`,
    },

    responseId: {
      sql: `submission_id`,
      type: `string`,
      description: `Unique identifier linking related feedback records (submission_id in Hub)`,
    },

    userId: {
      sql: `user_id`,
      type: `string`,
      description: `Identifier of the user who provided feedback`,
    },

    tenantId: {
      sql: `tenant_id`,
      type: `string`,
      description: `Tenant ID linking to FeedbackDirectory`,
    },

    // ── Normalized (LOWER+TRIM) companions ────────────────────────────────────
    // Hidden helper dimensions for case- and whitespace-insensitive EXACT matching.
    // The Cube queryRewrite (docker/cube/cube.js) transparently swaps a user's
    // `equals`/`notEquals` filter on the visible dimension to its *Normalized
    // companion (and lowercases/trims the value), so exact-match filtering is not
    // defeated by casing/whitespace drift in human-entered source/field text. The
    // visible dimensions above are left untouched for grouping and display.
    // Keep this set in sync with CASE_INSENSITIVE_EQUALS_DIMENSIONS in cube.js.
    sourceTypeNormalized: {
      sql: `LOWER(TRIM(source_type))`,
      type: `string`,
      shown: false,
    },

    sourceNameNormalized: {
      sql: `LOWER(TRIM(source_name))`,
      type: `string`,
      shown: false,
    },

    fieldTypeNormalized: {
      // field_type is a Postgres enum (field_type_enum); TRIM/LOWER only accept text, so cast
      // first (btrim(field_type_enum) does not exist). The other companions are text columns.
      sql: `LOWER(TRIM(field_type::text))`,
      type: `string`,
      shown: false,
    },

    fieldLabelNormalized: {
      sql: `LOWER(TRIM(field_label))`,
      type: `string`,
      shown: false,
    },

    fieldGroupLabelNormalized: {
      sql: `LOWER(TRIM(field_group_label))`,
      type: `string`,
      shown: false,
    },

    languageNormalized: {
      sql: `LOWER(TRIM(language))`,
      type: `string`,
      shown: false,
    },

    valueTextNormalized: {
      sql: `LOWER(TRIM(value_text))`,
      type: `string`,
      shown: false,
    },
  },
});
