import { doc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

function getRoomRef(db, dbPathPrefix, roomId) {
    return doc(db, dbPathPrefix, roomId);
}

export async function createRoom(db, dbPathPrefix, roomId, data) {
    await setDoc(getRoomRef(db, dbPathPrefix, roomId), data);
}

export async function patchRoom(db, dbPathPrefix, roomId, partialData) {
    await updateDoc(getRoomRef(db, dbPathPrefix, roomId), partialData);
}

export function subscribeRoom(db, dbPathPrefix, roomId, onChange) {
    return onSnapshot(getRoomRef(db, dbPathPrefix, roomId), onChange);
}
