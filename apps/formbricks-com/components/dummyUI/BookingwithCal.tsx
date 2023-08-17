import type { BookingwithCalQuestion } from "@formbricks/types/questions";
import { getCalApi } from "@calcom/embed-react";
import { useEffect } from "react";
import { useState } from "react";

interface BookingwithCalProps {
    question: BookingwithCalQuestion;
}

export default function BookingwithCalQuestion({
    question
}: BookingwithCalProps) 