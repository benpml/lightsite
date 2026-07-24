import { cn } from "@/lib/utils"

const HANDOUT_LOADER_DURATION = "0.8s"
const HOLD_SPLINES = "0 0 1 1;0.45 0 0.2 1;0 0 1 1"

const HANDOUT_LOADER_PIECES = [
  {
    id: "top",
    source:
      "M7.47266 3.19762C7.47266 2.95824 7.60241 2.73766 7.81165 2.62135L11.5478 0.544554C11.9873 0.300273 12.5274 0.618038 12.5274 1.12083V7.60923C12.5274 7.84862 12.3977 8.0692 12.1885 8.1855L8.45231 10.2623C8.01285 10.5066 7.47266 10.1888 7.47266 9.68602V3.19762Z",
    target:
      "M7.47266 1.90079C7.47266 1.66141 7.60246 1.44083 7.81166 1.32452L11.54786 -0.75228C11.98726 -0.99656 12.52746 -0.67879 12.52746 -0.176V8.90601C12.52746 9.14541 12.39776 9.36601 12.18846 9.48231L8.45236 11.55911C8.01286 11.80341 7.47266 11.48561 7.47266 10.98281V1.90079Z",
    morphKeyTimes: "0;0.31;0.43;1",
    moveKeyTimes: "0;0.27;0.47;1",
    translation: "7.47264 6.05269",
  },
  {
    id: "left",
    source:
      "M0 6.65661C0 6.41722 0.129755 6.19664 0.33899 6.08033L4.07514 4.00354C4.5146 3.75926 5.05479 4.07702 5.05479 4.57981V13.878C5.05479 14.1174 4.92504 14.338 4.7158 14.4543L0.979652 16.5311C0.540191 16.7753 0 16.4576 0 15.9548V6.65661Z",
    target:
      "M0 8.06152C0 7.82214 0.12975 7.60156 0.33899 7.48525L4.07514 5.408454C4.51464 5.164173 5.05474 5.481938 5.05474 5.98473V12.47313C5.05474 12.71252 4.92504 12.9331 4.71584 13.0494L0.97965 15.1262C0.54019 15.3705 0 15.0527 0 14.54992V8.06152Z",
    morphKeyTimes: "0;0.56;0.68;1",
    moveKeyTimes: "0;0.52;0.72;1",
    translation: "7.47266 -4.8639",
  },
  {
    id: "bottom",
    source:
      "M7.47266 14.0062C7.47266 13.7668 7.60241 13.5462 7.81165 13.4299L11.5478 11.3531C11.9873 11.1089 12.5275 11.4266 12.5275 11.9294V18.4178C12.5275 18.6572 12.3977 18.8778 12.1885 18.9941L8.45231 21.0709C8.01285 21.3152 7.47266 20.9974 7.47266 20.4946V14.0062Z",
    target:
      "M7.47266 12.60131C7.47266 12.36192 7.602415 12.14134 7.81165 12.02503L11.5478 9.94824C11.98726 9.70396 12.52745 10.02172 12.52745 10.52451V19.8227C12.52745 20.0621 12.3977 20.2827 12.18846 20.399L8.452312 22.4758C8.012851 22.72 7.47266 22.4023 7.47266 21.8995V12.60131Z",
    morphKeyTimes: "0;0.81;0.93;1",
    moveKeyTimes: "0;0.77;0.97;1",
    translation: "-7.47266 -5.9447",
  },
  {
    id: "right",
    source:
      "M14.9453 7.95348C14.9453 7.7141 15.0751 7.49352 15.2843 7.37721L19.0205 5.30041C19.4599 5.05613 20.0001 5.3739 20.0001 5.87669V14.9587C20.0001 15.1981 19.8704 15.4187 19.6611 15.535L15.925 17.6118C15.4855 17.8561 14.9453 17.5383 14.9453 17.0355V7.95348Z",
    target:
      "M14.9453 9.2503C14.9453 9.0109 15.07505 8.7903 15.28429 8.674L19.02044 6.5972C19.45994 6.353 20.00014 6.6707 20.00014 7.1735V13.6619C20.00014 13.9013 19.87034 14.1219 19.66114 14.2382L15.92495 16.315C15.48549 16.5593 14.9453 16.2415 14.9453 15.7387V9.2503Z",
    morphKeyTimes: "0;0.06;0.18;1",
    moveKeyTimes: "0;0.02;0.22;1",
    translation: "-7.47264 4.7559",
  },
] as const

function Spinner({
  className,
  "aria-label": ariaLabel = "Loading",
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      data-slot="spinner"
      role="status"
      aria-label={ariaLabel}
      width="20"
      height="22"
      viewBox="0 0 20 22"
      fill="none"
      focusable="false"
      className={cn(
        "size-auto h-5 shrink-0 text-muted-foreground in-data-[slot=button]:text-current",
        className,
      )}
      {...props}
    >
      <g className="motion-reduce:hidden" fill="currentColor">
        {HANDOUT_LOADER_PIECES.map((piece) => (
          <g key={piece.id}>
            <path d={piece.source}>
              <animate
                attributeName="d"
                dur={HANDOUT_LOADER_DURATION}
                repeatCount="indefinite"
                calcMode="spline"
                keyTimes={piece.morphKeyTimes}
                keySplines={HOLD_SPLINES}
                values={`${piece.source};${piece.source};${piece.target};${piece.target}`}
              />
            </path>
            <animateTransform
              attributeName="transform"
              type="translate"
              dur={HANDOUT_LOADER_DURATION}
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes={piece.moveKeyTimes}
              keySplines={HOLD_SPLINES}
              values={`0 0;0 0;${piece.translation};${piece.translation}`}
            />
          </g>
        ))}
      </g>
      <g className="hidden motion-reduce:inline" fill="currentColor">
        {HANDOUT_LOADER_PIECES.map((piece) => (
          <path key={piece.id} d={piece.source} />
        ))}
      </g>
    </svg>
  )
}

export { Spinner }
