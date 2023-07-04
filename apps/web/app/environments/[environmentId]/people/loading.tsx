import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";

export default function Loading({ params }) {
    if (!params || typeof params.environmentId === 'undefined') {
        return <EmptySpaceFiller type={"table"} environmentId={""} />;
    }
    return <EmptySpaceFiller type={"table"} environmentId={params.environmentId} />;
}