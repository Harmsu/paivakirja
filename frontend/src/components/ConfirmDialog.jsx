// Oma vahvistusdialogi: window.confirm() ei näy iOS:n kotivalikko-PWA:ssa (opittu siemenhallinnasta).
export default function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="card modal" role="alertdialog" onClick={e => e.stopPropagation()}>
        <p>{message}</p>
        <div className="row end">
          <button className="link" onClick={onCancel}>Peruuta</button>
          <button className="danger-btn" onClick={onConfirm} autoFocus>Poista</button>
        </div>
      </div>
    </div>
  );
}
