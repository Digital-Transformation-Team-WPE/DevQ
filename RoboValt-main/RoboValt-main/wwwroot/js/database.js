window.DatabasePage = (function () {
    function getAntiForgeryToken(root) {
        const el = (root || document).querySelector('input[name="__RequestVerificationToken"]');
        return el ? el.value : '';
    }

    async function updatePoint(container, rowEl) {
        const tableName = container.getAttribute('data-table-name');  // <-- Program table name
        if (!tableName) {
            toast('No table name provided.', 'error');  // implement toast or console.warning
            return;
        }

        const id = parseInt(rowEl.getAttribute('data-id'), 10);
        if (!id || id <= 0) {
            toast('Invalid Id.', 'error');
            return;
        }
        // example: read edited cell value from a contenteditable cell
        const pointCell = rowEl.querySelector('[data-col="Point"]');
        const newPoint = pointCell ? (pointCell.textContent || '').trim() : '';

        const payload = {
            id: id,
            changes: { Point: newPoint } // <-- Option A payload shape
        };

        const token = getAntiForgeryToken(container);

        const resp = await fetch(`/Database/UpdateRow?tableName=${encodeURIComponent(tableName)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': token,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(payload)
        });

        const result = await resp.json();
        if (result.success) {
            toast('Saved.', 'success');
        } else {
            toast(result.message || 'Update failed.', 'error');
            console.error(result.detail || '');
        }
    }

    function bindDelegatedHandlers() {
        // Delegated click handler survives partial reloads
        document.addEventListener('click', function (e) {
            const btn = e.target.closest('[data-db-action="edit-point"]');
            if (!btn) return;

            e.preventDefault();

            // works for both Master and Program, provided container has data-table-name set
            const container = btn.closest('#program-table, #master-table, #database-section');
            const row = btn.closest('tr');
            if (!container || !row) return;

            updatePoint(container, row);
        });
    }

    function reparseValidation(root) {
        if (window.$ && $.validator && $.validator.unobtrusive) {
            $.validator.unobtrusive.parse(root || document);
        }
    }

    function init() {
        // Called after the Database partial is injected into the shell
        bindDelegatedHandlers();          // one-time safe
        reparseValidation();              // parse any new forms in the section
    }

    return { init };
})();