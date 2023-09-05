import React from 'react';
import { Formik, Form, Field } from 'formik';
import CalBookingEmbed from './CalBookingEmbed'; // Import the CalBookingEmbed component

const SurveyForm = () => {
  const handleSubmit = (values, { resetForm }) => {
    // Handle form submission logic here
    console.log(values);
    resetForm();
  };

  return (
    <div>
      <h1>Survey Form</h1>
      <Formik
        initialValues={{ calLink: '' }}
        onSubmit={handleSubmit}
      >
        <Form>
          <div>
            <label htmlFor="calLink">Cal.com Link:</label>
            <Field type="text" id="calLink" name="calLink" />
          </div>
          <div>
            <button type="submit">Submit</button>
          </div>
        </Form>
      </Formik>

      {/* Display the Cal.com booking embed */}
      <CalBookingEmbed calLink="https://cal.com/your-booking-link" />
    </div>
  );
};

export default SurveyForm;
