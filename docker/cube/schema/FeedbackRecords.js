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
  },
});
