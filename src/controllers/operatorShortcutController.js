export function resolveOperatorShortcutAction(event, { isLiveModalOpen, isRoomAdmin }) {
    if (!event || !isLiveModalOpen || !isRoomAdmin) return null;
    if (event.ctrlKey || event.metaKey || event.altKey) return null;

    const target = event.target;
    const tagName = target?.tagName ? String(target.tagName).toUpperCase() : "";
    if (tagName === "INPUT" || tagName === "TEXTAREA" || target?.isContentEditable) return null;

    switch (event.code) {
        case "Digit1":
        case "Numpad1":
            return "p1_plus";
        case "Digit2":
        case "Numpad2":
            return "p2_plus";
        case "KeyQ":
            return "p1_minus";
        case "KeyW":
            return "p2_minus";
        case "Enter":
            return "finish_match";
        case "Escape":
            return "close_modal";
        default:
            return null;
    }
}
