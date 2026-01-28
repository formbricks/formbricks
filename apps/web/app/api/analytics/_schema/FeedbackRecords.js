cube(`FeedbackRecords`, {
  sql: `SELECT * FROM feedback_records`,

  measures: {
    count: {
      type: `count`,
      description: `Total number of feedback responses`,
    },

    promoterCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.value_number >= 9` }],
      description: `Number of promoters (NPS score 9-10)`,
    },

    detractorCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.value_number <= 6` }],
      description: `Number of detractors (NPS score 0-6)`,
    },

    passiveCount: {
      type: `count`,
      filters: [{ sql: `${CUBE}.value_number >= 7 AND ${CUBE}.value_number <= 8` }],
      description: `Number of passives (NPS score 7-8)`,
    },

    npsScore: {
      type: `number`,
      sql: `
        CASE 
          WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND(
            (
              (COUNT(CASE WHEN ${CUBE}.value_number >= 9 THEN 1 END)::numeric - 
               COUNT(CASE WHEN ${CUBE}.value_number <= 6 THEN 1 END)::numeric) 
              / COUNT(*)::numeric
            ) * 100,
            2
          )
        END
      `,
      description: `Net Promoter Score: ((Promoters - Detractors) / Total) * 100`,
    },

    averageScore: {
      type: `avg`,
      sql: `${CUBE}.value_number`,
      description: `Average NPS score`,
    },
  },

  dimensions: {
    id: {
      sql: `id`,
      type: `string`,
      primaryKey: true,
    },

    sentiment: {
      sql: `sentiment`,
      type: `string`,
      description: `Sentiment extracted from metadata JSONB field`,
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

    collectedAt: {
      sql: `collected_at`,
      type: `time`,
      description: `Timestamp when the feedback was collected`,
    },

    npsValue: {
      sql: `value_number`,
      type: `number`,
      description: `Raw NPS score value (0-10)`,
    },

    responseId: {
      sql: `response_id`,
      type: `string`,
      description: `Unique identifier linking related feedback records`,
    },

    userIdentifier: {
      sql: `user_identifier`,
      type: `string`,
      description: `Identifier of the user who provided feedback`,
    },

    emotion: {
      sql: `emotion`,
      type: `string`,
      description: `Emotion extracted from metadata JSONB field`,
    },
  },

  joins: {
    TopicsUnnested: {
      sql: `${CUBE}.id = ${TopicsUnnested}.feedback_record_id`,
      relationship: `hasMany`,
    },
  },
});

cube(`TopicsUnnested`, {
  sql: `
    SELECT 
      fr.id as feedback_record_id,
      topic_elem.topic
    FROM feedback_records fr
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(fr.metadata->'topics', '[]'::jsonb)) AS topic_elem(topic)
  `,

  measures: {
    count: {
      type: `count`,
    },
  },

  dimensions: {
    id: {
      sql: `feedback_record_id || '-' || topic`,
      type: `string`,
      primaryKey: true,
    },

    feedbackRecordId: {
      sql: `feedback_record_id`,
      type: `string`,
    },

    topic: {
      sql: `topic`,
      type: `string`,
      description: `Individual topic from the topics array`,
    },
  },
});
