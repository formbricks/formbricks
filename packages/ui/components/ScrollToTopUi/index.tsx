import { ArrowUp } from "lucide-react"
import { useState,useRef} from "react";


interface ScrollablePageWrapper {
    children: React.ReactNode;
    className?: string;
  }
  

export const ScrollToTopUi = ({ children }: ScrollablePageWrapper) => {

const endRef = useRef<HTMLDivElement>(null);
const startRef = useRef<HTMLDivElement>(null);
const [openTopButton, setOpenTopButton] = useState(false);
const SCROLL_THRESHOLD = 150;
const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
      const scrollTop = event.currentTarget.scrollTop;
       if (scrollTop > SCROLL_THRESHOLD) {
       setOpenTopButton(true);
        } else {
        setOpenTopButton(false);
        }
     };
return  <div className="space-y-6 max-h-[500px]  overflow-y-scroll no-scrollbar"  ref={endRef} onScroll={handleScroll}>
            <div ref={startRef}></div>
            <>{children}</>
            {openTopButton && <div className="ml-1  absolute bottom-4 left-1/2 flex items-center rounded-md bg-brand-dark  px-2 py-1 text-xs text-slate-50">
                <div onClick = {() => {startRef.current?.scrollIntoView({ behavior: "smooth" })}}  className="sm flex gap-2 w-[100px] justify-center bg-brand-dark cursor-pointer"><span >
                <ArrowUp className="h-4 w-6" />  </span>Top
                </div>
            </div>}
        </div>
}