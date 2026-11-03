* Analysis export: SPSS syntax for the CSV file next to this one.
* Set the folder in the CD line below to where you unzipped the export, then run all.
CD 'C:\path\to\the\unzipped\export'.
* This syntax reads the codes file. The labels file is for reading, not for SPSS.

GET DATA
  /TYPE=TXT
  /FILE='codes.csv'
  /ENCODING='UTF8'
  /DELCASE=LINE
  /DELIMITERS=","
  /QUALIFIER='"'
  /ARRANGEMENT=DELIMITED
  /FIRSTCASE=2
  /VARIABLES=
    response_id A6
    language A2
    outcome A1
    timestamp A23
    finished F1.0
    colour F1.0
    fruit_apple F1.0
    fruit_banana F1.0
    fruit_cherry F1.0
    region A24
    nps F1.0
    feedback A1719
    rank_price F1.0
    rank_speed F1.0
    city F1.0
  .

* Columns with answers that matched no option are read as text, kept in a _raw column, then converted.
SET MXWARNS=10000.
STRING region_raw (A24).
COMPUTE region_raw = region.
ALTER TYPE region (F2.0).
COMPUTE timestamp_dt = NUMBER(SUBSTR(timestamp, 1, 19), YMDHMS19).
FORMATS timestamp_dt (DATETIME20).
EXECUTE.

VARIABLE LABELS
  response_id 'Response ID'
  language 'Language'
  outcome 'Outcome'
  timestamp 'Timestamp'
  timestamp_dt 'Timestamp as a date and time (UTC)'
  finished 'Finished'
  colour 'Which colour do you prefer?'
  fruit_apple 'Which fruit do you eat? (it''s a long one) - Apple'
  fruit_banana 'Which fruit do you eat? (it''s a long one) - Banana'
  fruit_cherry 'Which fruit do you eat? (it''s a long one) - Cherry'
  region 'Where do you live?'
  region_raw 'Where do you live? (raw text)'
  nps 'How likely are you to recommend us?'
  feedback 'Tell us more'
  rank_price 'Rank these - Price'
  rank_speed 'Rank these - Speed'
  city 'في أي مدينة تسكن؟'.

VALUE LABELS
  finished
  1 'Finished'
  0 'Not finished'.
VALUE LABELS
  colour
  1 'Red'
  2 'Blue'
  3 'Green'.
VALUE LABELS
  fruit_apple fruit_banana fruit_cherry
  1 'Selected'
  0 'Not selected'.
VALUE LABELS
  region
  1 'Central Province'
  2 'Western Province'
  98 'Eastern Province'.
VALUE LABELS
  city
  1 'الرياض'
  2 'جدة'.

VARIABLE LEVEL
  response_id language outcome timestamp finished colour fruit_apple fruit_banana fruit_cherry region feedback city (NOMINAL)
  /timestamp_dt (SCALE)
  /nps rank_price rank_speed (ORDINAL).

MRSETS
  /MDGROUP NAME=$fruit
    LABEL='Which fruit do you eat? (it''s a long one)'
    VARIABLES=
      fruit_apple fruit_banana fruit_cherry
    VALUE=1.

EXECUTE.
