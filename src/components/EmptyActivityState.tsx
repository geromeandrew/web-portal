import paperIcon from "../assets/paper.svg";

export function EmptyActivityState({ message = "Uploaded files will appear here" }: { message?: string }) {
  return (
    <div className="grid min-h-[584px] place-items-center px-6 text-center">
      <div>
        <img src={paperIcon} alt="" aria-hidden="true" className="mx-auto h-[78px] w-auto" />
        <p className="mt-5 font-elliot text-[12px] text-[#69717d]">{message}</p>
      </div>
    </div>
  );
}
