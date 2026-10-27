* Analysis export: SPSS syntax for the CSV file next to this one.
* Set the folder in the CD line below to where you unzipped the export, then run all.
CD 'C:\path\to\the\unzipped\export'.

GET DATA
  /TYPE=TXT
  /FILE='data.csv'
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
    colour A8
    fruit_apple F1.0
    fruit_banana F1.0
    fruit_cherry F1.0
    region A16
    nps F1.0
    feedback A1719
    rank_price F1.0
    rank_speed F1.0
    city A12
  .

* Columns with answers that matched no option are read as text, kept in a _raw column, then converted.
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
  fruit_apple fruit_banana fruit_cherry
  1 'Selected'
  0 'Not selected'.

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
