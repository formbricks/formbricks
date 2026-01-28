cube(`FeedbackRecords`, {
  sql: `
    SELECT
      id,
      created_at as collected_at,
      (data->>'q18782jji4swm64miro9ei7e')::numeric as value_number
    FROM "Response"
    WHERE "surveyId" = 'clseedsurveykitchen00'
    AND data->>'q18782jji4swm64miro9ei7e' IS NOT NULL
  `,
  
  measures: {
    count: {
      type: `count`
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
      `
    }
  },
  
  dimensions: {
    collectedAt: {
      sql: `collected_at`,
      type: `time`
    },
    value: {
      sql: `value_number`,
      type: `number`
    }
  }
});
