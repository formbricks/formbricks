// This schema maps to the `feedback_records` table owned by the Formbricks Hub Postgres.
// If the Hub changes column names or types, this schema must be updated to match.
cube(`FeedbackRecords`, {
  sql: `SELECT * FROM feedback_records`,

  measures: {
    count: {
      type: `count`,
      description: `Total number of feedback records`,
    },

    uniqueRespondents: {
      type: `countDistinct`,
      sql: `${CUBE}.user_id`,
      description: `Unique identified people who gave feedback, deduplicated by person — one respondent answering 3 questions counts once. Anonymous feedback (no identified respondent) isn't counted here, even though it counts as a Feedback Record.`,
    },

    uniqueResponses: {
      type: `countDistinct`,
      sql: `${CUBE}.submission_id`,
      description: `Unique survey submissions, deduplicated by submission — one respondent submitting twice counts twice`,
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

    // ── Response context (ENG-1554 metadata) ──────────────────────────────────
    // Projections of the allowlisted keys `HUB_METADATA_FIELDS`
    // (apps/web/lib/feedback-source/response-metadata.ts) writes onto every record of a
    // submission. `metadata` is a free-form jsonb column that the public API, CSV import and MCP
    // can also fill, so the two non-text dimensions read their value through a CASE that yields
    // NULL for anything unparseable: a bare cast fails the whole query on a single malformed row.
    // Records ingested before those keys existed carry no metadata and read as NULL here.
    metadataSource: {
      sql: `${CUBE}.metadata->>'source'`,
      type: `string`,
      description: `Channel the response came in through (e.g. link, app, email). Distinct from sourceType, which names the system the record came from (formbricks_survey, csv).`,
    },

    metadataUrl: {
      sql: `${CUBE}.metadata->>'url'`,
      type: `string`,
      description: `Page the survey was answered on, reduced to origin + path — the query string and any personal-link token are stripped at ingestion. High cardinality: one bucket per path.`,
    },

    metadataBrowser: {
      sql: `${CUBE}.metadata->>'browser'`,
      type: `string`,
      description: `Browser reported by the respondent's user agent (e.g. Chrome, Safari)`,
    },

    metadataOs: {
      sql: `${CUBE}.metadata->>'os'`,
      type: `string`,
      description: `Operating system reported by the respondent's user agent (e.g. macOS, Android)`,
    },

    metadataDevice: {
      sql: `${CUBE}.metadata->>'device'`,
      type: `string`,
      description: `Device class reported by the respondent's user agent (e.g. desktop, mobile)`,
    },

    metadataCountry: {
      sql: `${CUBE}.metadata->>'country'`,
      type: `string`,
      description: `Country the response was collected from, as resolved at collection time`,
    },

    metadataAction: {
      sql: `${CUBE}.metadata->>'action'`,
      type: `string`,
      description: `Name of the action that triggered the survey. App surveys only; NULL for link surveys.`,
    },

    metadataFinished: {
      // LOWER on the extracted text rather than a jsonb_typeof check: a boolean stored as jsonb
      // renders as 'true'/'false' here anyway, and this also accepts the string form a CSV or API
      // writer can put in the same key. Anything else is NULL rather than a failed cast.
      sql: `
        CASE
          WHEN LOWER(${CUBE}.metadata->>'finished') IN ('true', 'false')
            THEN LOWER(${CUBE}.metadata->>'finished')::boolean
        END
      `,
      type: `boolean`,
      description: `Whether the respondent completed the survey. Live ingestion runs on responseFinished only, so this is true for everything except records from a historical import run over all responses.`,
    },

    metadataDurationSeconds: {
      // The regex accepts both a jsonb number (rendered '42' / '42.5' by ->>) and the string form;
      // everything else, including exponent notation, reads as no value instead of failing the cast.
      sql: `
        CASE
          WHEN ${CUBE}.metadata->>'duration_seconds' ~ '^-?[0-9]+(\\.[0-9]+)?$'
            THEN (${CUBE}.metadata->>'duration_seconds')::double precision
        END
      `,
      type: `number`,
      description: `Seconds the respondent took to complete the survey. A response-level value repeated on every record of the submission, so an average across records is weighted by question count.`,
    },

    metadataEndingId: {
      sql: `${CUBE}.metadata->>'ending_id'`,
      type: `string`,
      description: `Id of the ending the respondent reached — the branch they came out of. Stored as the id, not the ending's text.`,
    },

    metadataSurveyType: {
      sql: `${CUBE}.metadata->>'survey_type'`,
      type: `string`,
      description: `Type of the survey the response came from (link, app, website). Distinct from sourceType, which names the ingesting system.`,
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
      description: `Text answer value (open text, or the label of a multiple-choice/categorical answer). Buckets by the exact text, so a translated label, an edited label or a free-text 'other' answer each becomes its own bucket — for choice questions prefer valueId. Pair with a fieldType filter to keep types consistent.`,
    },

    valueId: {
      sql: `value_id`,
      type: `string`,
      description: `Recommended for single-select and multi-select answers: the stable option id keeps one option in one bucket across languages, after a label edit, and for free-text 'other' answers. Charts show the option's label, not the id.`,
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

    // Response-context companions. Only the values a person, a user agent or an importing client
    // supplies get one; metadataEndingId and metadataSurveyType are values this product generates,
    // so they cannot drift in casing.
    metadataSourceNormalized: {
      sql: `LOWER(TRIM(${CUBE}.metadata->>'source'))`,
      type: `string`,
      shown: false,
    },

    metadataUrlNormalized: {
      sql: `LOWER(TRIM(${CUBE}.metadata->>'url'))`,
      type: `string`,
      shown: false,
    },

    metadataBrowserNormalized: {
      sql: `LOWER(TRIM(${CUBE}.metadata->>'browser'))`,
      type: `string`,
      shown: false,
    },

    metadataOsNormalized: {
      sql: `LOWER(TRIM(${CUBE}.metadata->>'os'))`,
      type: `string`,
      shown: false,
    },

    metadataDeviceNormalized: {
      sql: `LOWER(TRIM(${CUBE}.metadata->>'device'))`,
      type: `string`,
      shown: false,
    },

    metadataCountryNormalized: {
      sql: `LOWER(TRIM(${CUBE}.metadata->>'country'))`,
      type: `string`,
      shown: false,
    },

    metadataActionNormalized: {
      sql: `LOWER(TRIM(${CUBE}.metadata->>'action'))`,
      type: `string`,
      shown: false,
    },
  },
});
