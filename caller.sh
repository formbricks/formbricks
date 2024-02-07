# Initialize the number file if it does not exist
if [ ! -f "number_store.txt" ]; then
    echo 1 >number_store.txt
fi

# Read the number, increment it and save
INCREMENTAL_NUMBER=$(cat number_store.txt)
INCREMENTAL_NUMBER=$((INCREMENTAL_NUMBER + 1))
echo $INCREMENTAL_NUMBER >number_store.txt

# Call the script with the incremental number
/home/shubham/Desktop/formbricks/submit_survey.sh $INCREMENTAL_NUMBER
