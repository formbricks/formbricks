# Payment Question Type Implementation for Formbricks

## Overview

I have successfully implemented a payment question type for Formbricks that integrates with Stripe to collect payments directly through survey responses. This allows survey creators to monetize their surveys by collecting one-time payments or subscription fees from respondents.

## Features Implemented

### 1. Type System Updates
- Added `Payment = "payment"` to `TSurveyQuestionTypeEnum` in `packages/types/surveys/types.ts`
- Created comprehensive `ZSurveyPaymentQuestion` schema with the following fields:
  - `amount`: Payment amount (minimum $0.01)
  - `currency`: Three-letter currency code (default: USD)
  - `paymentType`: "one-time" or "subscription" 
  - `collectBillingAddress`: Boolean flag
  - `collectShippingAddress`: Boolean flag
  - `allowPromotionCodes`: Boolean flag
  - `subscriptionData`: Optional subscription configuration
    - `intervalCount`: Number of intervals (e.g., 1, 2, 3)
    - `interval`: Interval type ("day", "week", "month", "year")
    - `trialPeriodDays`: Optional trial period in days
  - `stripeProductId`: Optional Stripe product ID
  - `stripePriceId`: Optional Stripe price ID

### 2. UI Components

#### Payment Question Component (`packages/surveys/src/components/questions/payment-question.tsx`)
- Displays payment information with formatted amounts and currency
- Shows subscription details (interval, trial period)
- Integrates with Stripe Checkout for payment processing
- Handles payment flow via Stripe Checkout sessions
- Provides error handling and loading states
- Supports both one-time payments and subscriptions

#### Payment Question Form (`apps/web/modules/survey/editor/components/payment-question-form.tsx`)
- Comprehensive editor interface for configuring payment questions
- Payment type selection (one-time vs subscription)
- Amount and currency configuration
- Subscription interval settings (daily, weekly, monthly, yearly)
- Trial period configuration for subscriptions
- Toggles for billing/shipping address collection
- Promotion code support toggle

### 3. API Integration

#### Stripe Checkout Session API (`apps/web/app/api/stripe/create-checkout-session/route.ts`)
- Creates Stripe Checkout sessions for payment processing
- Supports both one-time payments and subscriptions
- Validates survey and question data
- Configures Stripe session with appropriate metadata
- Handles subscription pricing and trial periods
- Implements proper error handling and logging

### 4. Survey Editor Integration
- Added payment question to question type registry in `apps/web/modules/survey/lib/questions.tsx`
- Integrated payment question form into the question card editor
- Added CreditCard icon for payment questions
- Configured default presets for new payment questions

### 5. Survey Response Integration
- Added payment question to conditional rendering in `packages/surveys/src/components/general/question-conditional.tsx`
- Integrated payment question into survey flow

### 6. Filtering and Analytics
- Added payment question support to survey filtering system
- Implemented filter options: "Paid", "Failed", "Skipped"
- Added payment question to Notion integration type mapping
- Created payment question summary type for analytics

## Configuration Requirements

### Environment Variables
The payment question type requires the following Stripe environment variables:
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Dependencies
The implementation relies on existing Stripe integration in Formbricks:
- `stripe` package for server-side API calls
- Existing Stripe billing infrastructure
- Formbricks environment and survey management system

## Usage

### Creating a Payment Question
1. In the survey editor, click "Add Question"
2. Select "Payment" from the question types
3. Configure the payment details:
   - Set the amount and currency
   - Choose between one-time payment or subscription
   - For subscriptions, set the billing interval and optional trial period
   - Configure address collection and promotion code options
4. Customize the question headline and button labels

### Payment Flow
1. Survey respondent encounters the payment question
2. Question displays payment details and amount
3. When user clicks the payment button, a Stripe Checkout session is created
4. User is redirected to Stripe Checkout to complete payment
5. After successful payment, user is redirected back to the survey
6. Survey response is recorded with payment information

### Response Data Structure
Payment question responses include:
```typescript
{
  [questionId]: {
    paymentIntentId: string;
    amount: number;
    currency: string;
    status: "succeeded" | "failed" | "skipped";
  }
}
```

## What Still Needs Implementation

### 1. Webhook Handler
- Create a Stripe webhook handler to process payment events
- Update survey responses based on payment status changes
- Handle subscription lifecycle events (renewals, cancellations)

### 2. Payment Success/Failure Pages
- Create success and cancellation pages for payment completion
- Handle survey continuation after payment
- Display appropriate messaging for payment outcomes

### 3. Payment Analytics
- Implement payment analytics dashboard
- Show revenue metrics per survey
- Track conversion rates and payment success rates
- Generate payment reports

### 4. Enhanced Error Handling
- Improve error messages for payment failures
- Add retry mechanisms for failed payments
- Implement payment attempt tracking

### 5. Currency and Localization
- Expand currency support beyond basic options
- Add proper currency formatting for different locales
- Implement region-specific payment methods

### 6. Advanced Features
- Support for discount codes and coupons
- Dynamic pricing based on survey responses
- Multiple payment options (Stripe + PayPal, etc.)
- Payment plan templates for quick setup

### 7. Testing
- Add comprehensive unit tests for payment components
- Create integration tests for Stripe payment flow
- Add end-to-end tests for complete payment scenarios

### 8. Documentation
- Add payment question documentation to Formbricks docs
- Create setup guides for Stripe integration
- Add examples and best practices

## Security Considerations

- Payment amounts are validated on both client and server
- Stripe handles all sensitive payment data (PCI compliance)
- Survey and question validation prevents unauthorized payments
- Metadata tracking ensures payment attribution to correct surveys
- API endpoints include proper authentication and authorization

## Performance Optimizations

- Stripe Checkout sessions are created on-demand
- Payment components load asynchronously
- Efficient state management for payment flows
- Proper error boundaries to prevent payment failures from breaking surveys

This implementation provides a solid foundation for payment collection in Formbricks surveys while maintaining security, user experience, and integration with the existing Formbricks architecture.