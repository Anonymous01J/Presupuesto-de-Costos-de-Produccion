/* ========================================================
   Costos de Producción · Genérico · Responsive
   Lógica principal de la aplicación
   ======================================================== */

$(document).ready(function () {

  /* ── Formateador de moneda (estilo venezolano/europeo) ── */
  function formatCurrency(value) {
    if (isNaN(value)) return '0,00';
    let numStr = value.toFixed(2);
    let parts = numStr.split('.');
    let integerPart = parts[0];
    let decimalPart  = parts[1];
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return integerPart + ',' + decimalPart;
  }

  /* ── Formateador de inputs de precio ────────────────── */
  function InputPrice(selector) {
    $(document).off('input.inputPrice', selector)
               .on('input.inputPrice', selector, function (e) {
      let v = e.target.value.replace(/[^0-9]/g, '');
      const len = v.length;
      if (len === 0) { e.target.value = ''; return; }
      if (len <= 2) {
        e.target.value = '0,' + v.padStart(2, '0');
      } else {
        const intPart = v.slice(0, len - 2).replace(/^0+/, '') || '0';
        const decPart = v.slice(len - 2);
        const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        e.target.value = formatted + ',' + decPart;
      }
    });
  }
  InputPrice('.input-price');

  function parseFormattedNumber(str) {
    if (!str) return 0;
    const cleaned = str.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }

  /* ── Tasa de cambio desde API ───────────────────────── */
  $('#btnActualizarApi').on('click', function () {
    fetch('https://ve.dolarapi.com/v1/dolares')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0 && data[0].promedio) {
          $('#tasaCambio').val(parseFloat(data[0].promedio).toFixed(2));
          calcularTodo();
        } else {
          alert('No se pudo obtener la tasa desde la API. Estructura de datos inesperada.');
        }
      })
      .catch(() => {
        alert('No se pudo obtener la tasa desde la API. Verifique su conexión.');
      });
  });

  /* ── Select2: unidad de venta ───────────────────────── */
  $('#unidadVenta').select2({
    theme: 'bootstrap-5',
    width: '100%',
    dropdownParent: $('#costeoModal'),
    tags: true,
    placeholder: 'Seleccione o escriba',
    createTag: function (params) {
      return { id: params.term, text: params.term, newTag: true };
    }
  });

  function initSelect2Tabla() {
    $('.select2-unidad-tabla').select2({
      theme: 'bootstrap-5',
      width: '100%',
      dropdownParent: $('#costeoModal'),
      tags: true,
      createTag: function (params) {
        return { id: params.term, text: params.term, newTag: true };
      }
    });
  }
  initSelect2Tabla();

  $('#selectUnidadTiempo').select2({
    theme: 'bootstrap-5',
    width: '100%',
    dropdownParent: $('#costeoModal'),
    minimumResultsForSearch: -1
  }).on('change', function () {
    let unidad    = $(this).val();
    let textoPago = 'Pago/' + (unidad === 'hora' ? 'hora' : unidad === 'dia' ? 'día' : unidad === 'semana' ? 'semana' : 'mes') + ' (USD)';
    $('#thPago').text(textoPago);
    $('#thCantidad').text(unidad === 'hora' ? 'Horas' : unidad === 'dia' ? 'Días' : unidad === 'semana' ? 'Semanas' : 'Meses');
  });

  /* ── Variables globales ─────────────────────────────── */
  let tasa, util, iva, loteBase;

  /* ── DataTables ─────────────────────────────────────── */
  // Tabla Materia Prima: responsive inline (sin modal)
  var tableMP = $('#tablaMP').DataTable({
    paging: true, lengthChange: false, pageLength: 5, info: false, searching: false,
    ordering: false,
    responsive: true,  // Cambiado: ahora usa el renderer inline por defecto
    autoWidth: false,
    columnDefs: [
      { responsivePriority: 1, targets: [0, 1, 2, 3] },
      { responsivePriority: 2, targets: [4, 5, 6] },
      { responsivePriority: 3, targets: [7] }
    ]
  });

  // Tabla Mano de Obra: responsive inline
  var tableMOD = $('#tablaMOD').DataTable({
    paging: true, lengthChange: false, pageLength: 5, info: false, searching: false,
    ordering: false,
    responsive: true,
    autoWidth: false,
    columnDefs: [
      { responsivePriority: 1, targets: [0, 1, 3] },
      { responsivePriority: 2, targets: [2, 4, 5] },
      { responsivePriority: 3, targets: [6] }
    ]
  });

  // Tabla CIF: responsive inline
  var tableCIF = $('#tablaCIF').DataTable({
    paging: true, lengthChange: false, pageLength: 5, info: false, searching: false,
    ordering: false,
    responsive: true,
    autoWidth: false,
    columnDefs: [
      { responsivePriority: 1, targets: [0, 1, 2] },
      { responsivePriority: 2, targets: [3, 4, 5] },
      { responsivePriority: 3, targets: [6] }
    ]
  });

  // Tabla de resumen ejecutivo (fuera del modal)
  $('#resumen-ejecutivo-table').DataTable({
    responsive: true,
    searching: false,
    ordering: false,
    language: {
      url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json'
    },
    order: [[0, 'asc']],
    columnDefs: [
      { responsivePriority: 1, targets: [0] },
      { responsivePriority: 2, targets: [1,2,3] }
    ]
  });

  // Tabla comparativa (paso 5) - responsive
  var tableComparativa = $('#tablaComparativa').DataTable({
      paging: false,
      searching: false,
      info: false,
      ordering: false,
      responsive: true,
      columnDefs: [
          { responsivePriority: 1, targets: 0 },
          { responsivePriority: 2, targets: [1, 2, 3] }
      ]
  });

  /* ── Función para recalcular el paso actual ─────────── */
  function recalcCurrentStepTable() {
    if (currentStep === 2) {
      tableMP.columns.adjust().responsive.recalc();
    } else if (currentStep === 3) {
      tableMOD.columns.adjust().responsive.recalc();
    } else if (currentStep === 4) {
      tableCIF.columns.adjust().responsive.recalc();
    } else if (currentStep === 5) {
      tableComparativa.columns.adjust().responsive.recalc();
    }
  }

  /* ── Función principal de cálculo ───────────────────── */
  function calcularTodo() {
    tasa     = parseFloat($('#tasaCambio').val())    || 402.33;
    util     = parseFloat($('#porcUtilidad').val())  || 0;
    iva      = parseFloat($('#porcIva').val())        || 0;
    loteBase = parseFloat($('#loteBase').val())       || 1;

    let unidadVenta = $('#unidadVenta').val() || 'unidad';
    $('#resumenUnidadLabel, #resumenUnidadLabel2, #resumenUnidadLabel3, #resumenUnidadLote, #compUnidad, #unitarioUnidadLabel').text(unidadVenta);

    /* ·· MATERIA PRIMA ·· */
    let totalMPUsd = 0, totalMPBs = 0;
    $('#tablaMP tbody tr').each(function () {
      let cantidad   = parseFloat($(this).find('.cantidad').val()) || 0;
      let costoUsd   = parseFormattedNumber($(this).find('.costo-usd').val());
      let costoBs    = costoUsd * tasa;
      let subtotalUsd = cantidad * costoUsd;
      let subtotalBs  = cantidad * costoBs;

      $(this).find('.costo-bs').text(formatCurrency(costoBs));
      $(this).find('.subtotal-usd').text(formatCurrency(subtotalUsd));
      $(this).find('.subtotal-bs').text(formatCurrency(subtotalBs));

      totalMPUsd += subtotalUsd;
      totalMPBs  += subtotalBs;
    });
    $('#totalMPUsd').text(formatCurrency(totalMPUsd) + ' $');
    $('#totalMPBs').text(formatCurrency(totalMPBs)  + ' Bs.');

    /* ·· MANO DE OBRA ·· */
    let totalMODUsd = 0, totalMODBs = 0;
    $('#tablaMOD tbody tr').each(function () {
      let pagoUsd    = parseFormattedNumber($(this).find('.pago-usd').val());
      let cantidad   = parseFloat($(this).find('.cantidad-tiempo').val()) || 0;
      let pagoBs     = pagoUsd * tasa;
      let subtotalUsd = pagoUsd * cantidad;
      let subtotalBs  = pagoBs  * cantidad;

      $(this).find('.pago-bs').text(formatCurrency(pagoBs));
      $(this).find('.subtotal-usd').text(formatCurrency(subtotalUsd));
      $(this).find('.subtotal-bs').text(formatCurrency(subtotalBs));

      totalMODUsd += subtotalUsd;
      totalMODBs  += subtotalBs;
    });
    $('#totalMODUsd').text(formatCurrency(totalMODUsd) + ' $');
    $('#totalMODBs').text(formatCurrency(totalMODBs)  + ' Bs.');

    /* ·· CIF ·· */
    let totalCIFUsd = 0, totalCIFBs = 0;
    $('#tablaCIF tbody tr').each(function () {
      let costoUsd = parseFormattedNumber($(this).find('.costo-usd').val());
      let costoBs  = costoUsd * tasa;

      $(this).find('.costo-bs').text(formatCurrency(costoBs));
      $(this).find('.total-usd').text(formatCurrency(costoUsd));
      $(this).find('.total-bs').text(formatCurrency(costoBs));

      totalCIFUsd += costoUsd;
      totalCIFBs  += costoBs;
    });
    $('#totalCIFUsd').text(formatCurrency(totalCIFUsd) + ' $');
    $('#totalCIFBs').text(formatCurrency(totalCIFBs)  + ' Bs.');

    /* ·· Totales combinados ·· */
    let costoPrimoBs      = totalMPBs  + totalMODBs;
    let costoPrimoUsd     = totalMPUsd + totalMODUsd;
    let costoTotProdBs    = costoPrimoBs  + totalCIFBs;
    let costoTotProdUsd   = costoPrimoUsd + totalCIFUsd;
    let costoPorUnidadBs  = costoTotProdBs  / loteBase;
    let costoPorUnidadUsd = costoTotProdUsd / loteBase;
    let utilidadBs        = costoTotProdBs  * util;
    let utilidadUsd       = costoTotProdUsd * util;
    let precioVentaBs     = costoTotProdBs  + utilidadBs;
    let precioVentaUsd    = costoTotProdUsd + utilidadUsd;
    let precioVentaUnitBs  = precioVentaBs  / loteBase;
    let precioVentaUnitUsd = precioVentaUsd / loteBase;
    let ivaBs             = precioVentaBs  * iva;
    let ivaUsd            = precioVentaUsd * iva;
    let precioFinalBs     = precioVentaBs  + ivaBs;
    let precioFinalUsd    = precioVentaUsd + ivaUsd;
    let precioFinalUnitBs  = precioFinalBs  / loteBase;
    let precioFinalUnitUsd = precioFinalUsd / loteBase;

    /* ·· Resumen paso 5 ·· */
    $('#resumenFinal').html(`
      <table class="table table-sm">
        <tr><td>Costos Primos (MP+MOD)</td><td class="fw-bold">${formatCurrency(costoPrimoBs)} Bs.</td><td>${formatCurrency(costoPrimoUsd)} $</td></tr>
        <tr><td>Costos Indirectos (CIF)</td><td class="fw-bold">${formatCurrency(totalCIFBs)} Bs.</td><td>${formatCurrency(totalCIFUsd)} $</td></tr>
        <tr class="bg-verde"><td>Costo Total Producción</td><td class="fw-bold">${formatCurrency(costoTotProdBs)} Bs.</td><td>${formatCurrency(costoTotProdUsd)} $</td></tr>
        <tr><td>Costo por ${unidadVenta}</td><td class="fw-bold">${formatCurrency(costoPorUnidadBs)} Bs.</td><td>${formatCurrency(costoPorUnidadUsd)} $</td></tr>
        <tr class="bg-rojo"><td>Utilidad deseada (${(util * 100).toFixed(0)}%)</td><td class="fw-bold">${formatCurrency(utilidadBs)} Bs.</td><td>${formatCurrency(utilidadUsd)} $</td></tr>
        <tr class="bg-rojo"><td>Precio de Venta Total</td><td class="fw-bold">${formatCurrency(precioVentaBs)} Bs.</td><td>${formatCurrency(precioVentaUsd)} $</td></tr>
        <tr><td>Precio venta por ${unidadVenta}</td><td class="fw-bold">${formatCurrency(precioVentaUnitBs)} Bs.</td><td>${formatCurrency(precioVentaUnitUsd)} $</td></tr>
        <tr><td>IVA (${(iva * 100).toFixed(0)}%)</td><td class="fw-bold">${formatCurrency(ivaBs)} Bs.</td><td>${formatCurrency(ivaUsd)} $</td></tr>
        <tr class="bg-amarillo"><td>PRECIO FINAL POR ${unidadVenta.toUpperCase()} (con IVA)</td><td class="fw-bold">${formatCurrency(precioFinalUnitBs)} Bs.</td><td>${formatCurrency(precioFinalUnitUsd)} $</td></tr>
      </table>
    `);

    /* ·· Comparativo ·· */
    let factor12 = 12 / loteBase;
    let factor10 = 10 / loteBase;
    let factor6  =  6 / loteBase;

    const setCmp = (id12, id10, id6, valBs, valUsd) => {
      $(`#${id12}`).html(`${formatCurrency(valBs * factor12)} Bs. / ${formatCurrency(valUsd * factor12)} $`);
      $(`#${id10}`).html(`${formatCurrency(valBs * factor10)} Bs. / ${formatCurrency(valUsd * factor10)} $`);
      $(`#${id6}`).html( `${formatCurrency(valBs * factor6)}  Bs. / ${formatCurrency(valUsd * factor6)}  $`);
    };

    setCmp('compCosto12', 'compCosto10', 'compCosto6', costoTotProdBs, costoTotProdUsd);
    setCmp('compUtil12',  'compUtil10',  'compUtil6',  utilidadBs,      utilidadUsd);
    setCmp('compPVta12',  'compPVta10',  'compPVta6',  precioVentaBs,   precioVentaUsd);
    setCmp('compIva12',   'compIva10',   'compIva6',   ivaBs,           ivaUsd);
    setCmp('compFinal12', 'compFinal10', 'compFinal6', precioFinalBs,   precioFinalUsd);

    /* ·· Resumen ejecutivo principal ·· */
    const setRes = (ids, val12, val10, val6, valUnitBs, valUnitUsd) => {
      $(`#${ids[0]}`).text(formatCurrency(val12));
      $(`#${ids[1]}`).text(formatCurrency(val10));
      $(`#${ids[2]}`).text(formatCurrency(val6));
      $(`#${ids[3]}`).text(formatCurrency(valUnitBs));
      $(`#${ids[4]}`).text(formatCurrency(valUnitUsd));
    };

    setRes(['resCosto12','resCosto10','resCosto6','resCostoUnitBs','resCostoUnitUsd'],
      costoTotProdBs*factor12, costoTotProdBs*factor10, costoTotProdBs*factor6,
      costoPorUnidadBs, costoPorUnidadUsd);

    setRes(['resUtil12','resUtil10','resUtil6','resUtilUnitBs','resUtilUnitUsd'],
      utilidadBs*factor12, utilidadBs*factor10, utilidadBs*factor6,
      utilidadBs/loteBase, utilidadUsd/loteBase);

    setRes(['resPVta12','resPVta10','resPVta6','resPVtaUnitBs','resPVtaUnitUsd'],
      precioVentaBs*factor12, precioVentaBs*factor10, precioVentaBs*factor6,
      precioVentaUnitBs, precioVentaUnitUsd);

    setRes(['resIva12','resIva10','resIva6','resIvaUnitBs','resIvaUnitUsd'],
      ivaBs*factor12, ivaBs*factor10, ivaBs*factor6,
      ivaBs/loteBase, ivaUsd/loteBase);

    setRes(['resFinal12','resFinal10','resFinal6','resFinalUnitBs','resFinalUnitUsd'],
      precioFinalBs*factor12, precioFinalBs*factor10, precioFinalBs*factor6,
      precioFinalUnitBs, precioFinalUnitUsd);

    /* ·· Unitarios ·· */
    $('#costoUnitario').text(`${formatCurrency(costoPorUnidadBs)} Bs. · ${formatCurrency(costoPorUnidadUsd)} $`);
    $('#precioVentaUnitario').text(`${formatCurrency(precioVentaUnitBs)} Bs. · ${formatCurrency(precioVentaUnitUsd)} $`);
    $('#precioFinalUnitario').text(`${formatCurrency(precioFinalUnitBs)} Bs. · ${formatCurrency(precioFinalUnitUsd)} $`);

    // Forzar actualización de la tabla de resumen para que los detalles responsive reflejen los nuevos valores
    var dtResumen = $('#resumen-ejecutivo-table').DataTable();
    if (dtResumen) {
        dtResumen.rows().invalidate().draw(false);
    }

    // Forzar actualización de la tabla comparativa
    if (tableComparativa) {
        tableComparativa.rows().invalidate().draw(false);
    }
  }

  /* ── Eventos para recalcular ────────────────────────── */
  $('#tasaCambio, #porcUtilidad, #porcIva, #loteBase, #unidadVenta').on('change keyup', calcularTodo);
  $(document).on('input',
    '#tablaMP .cantidad, #tablaMP .costo-usd, #tablaMOD .pago-usd, #tablaMOD .cantidad-tiempo, #tablaCIF .costo-usd',
    function () { calcularTodo(); }
  );

  /* ── Agregar filas ──────────────────────────────────── */
  $('#addRowMP').click(function () {
    var newRow = `<tr>
      <td><input type="text" class="form-control form-control-sm" value="Nuevo"></td>
      <td><input type="number" class="form-control form-control-sm input-modificable cantidad" value="1" step="0.01"></td>
      <td><select class="form-select form-select-sm select2-unidad-tabla" style="width:100px;">
        <option value="kg">kg</option><option value="g">g</option>
        <option value="L">L</option><option value="ml">ml</option><option value="unidad">unidad</option>
      </select></td>
      <td><input type="text" class="form-control form-control-sm input-modificable input-price costo-usd" value="1,00"></td>
      <td><span class="costo-bs readonly-value">0,00</span></td>
      <td><span class="subtotal-usd readonly-value">0,00</span></td>
      <td><span class="subtotal-bs readonly-value">0,00</span></td>
      <td><button class="btn btn-sm btn-outline-danger remove-row"><i class="bi bi-trash"></i></button></td>
    </tr>`;
    var $row = $(newRow);
    tableMP.row.add($row[0]).draw();
    $row.find('.select2-unidad-tabla').select2({
      theme: 'bootstrap-5', width: '100%', dropdownParent: $('#costeoModal'),
      tags: true,
      createTag: function (params) { return { id: params.term, text: params.term, newTag: true }; }
    });
    calcularTodo();
    if (currentStep === 2) tableMP.columns.adjust().responsive.recalc();
  });

  $('#addRowMOD').click(function () {
    var newRow = `<tr>
      <td><input type="text" class="form-control form-control-sm" value="Nuevo cargo"></td>
      <td><input type="text" class="form-control form-control-sm input-modificable input-price pago-usd" value="5,00"></td>
      <td><span class="pago-bs readonly-value">0,00</span></td>
      <td><input type="number" class="form-control form-control-sm input-modificable cantidad-tiempo" value="1" step="0.1"></td>
      <td><span class="subtotal-bs readonly-value">0,00</span></td>
      <td><span class="subtotal-usd readonly-value">0,00</span></td>
      <td><button class="btn btn-sm btn-outline-danger remove-row"><i class="bi bi-trash"></i></button></td>
    </tr>`;
    var $row = $(newRow);
    tableMOD.row.add($row[0]).draw();
    calcularTodo();
    if (currentStep === 3) tableMOD.columns.adjust().responsive.recalc();
  });

  $('#addRowCIF').click(function () {
    var newRow = `<tr>
      <td><input type="text" class="form-control form-control-sm" value="Nuevo CIF"></td>
      <td><input type="text" class="form-control form-control-sm" value="base"></td>
      <td><input type="text" class="form-control form-control-sm input-modificable input-price costo-usd" value="1,00"></td>
      <td><span class="costo-bs readonly-value">0,00</span></td>
      <td><span class="total-usd readonly-value">0,00</span></td>
      <td><span class="total-bs readonly-value">0,00</span></td>
      <td><button class="btn btn-sm btn-outline-danger remove-row"><i class="bi bi-trash"></i></button></td>
    </tr>`;
    var $row = $(newRow);
    tableCIF.row.add($row[0]).draw();
    calcularTodo();
    if (currentStep === 4) tableCIF.columns.adjust().responsive.recalc();
  });

  /* ── Eliminar filas ─────────────────────────────────── */
  $(document).on('click', '.remove-row', function () {
    let row    = $(this).closest('tr');
    let tableId = row.closest('table').attr('id');
    if      (tableId === 'tablaMP')  tableMP.row(row).remove().draw();
    else if (tableId === 'tablaMOD') tableMOD.row(row).remove().draw();
    else if (tableId === 'tablaCIF') tableCIF.row(row).remove().draw();
    calcularTodo();
    if (tableId === 'tablaMP' && currentStep === 2) tableMP.columns.adjust().responsive.recalc();
    else if (tableId === 'tablaMOD' && currentStep === 3) tableMOD.columns.adjust().responsive.recalc();
    else if (tableId === 'tablaCIF' && currentStep === 4) tableCIF.columns.adjust().responsive.recalc();
  });

  /* ── Navegación entre pasos (wizard) ────────────────── */
  let currentStep = 1;
  const totalSteps = 5;

  function updateStepUI() {
    $('.step').removeClass('active');
    $(`#step${currentStep}`).addClass('active');
    $('.step-item').removeClass('active completed');
    for (let i = 1; i <= totalSteps; i++) {
      if (i === currentStep)      $(`.step-item[data-step="${i}"]`).addClass('active');
      else if (i < currentStep)   $(`.step-item[data-step="${i}"]`).addClass('completed');
    }
    $('#prevBtn').prop('disabled', currentStep === 1);
    if (currentStep === totalSteps) {
      $('#nextBtn').hide();
      $('#generateBtn').show();
    } else {
      $('#nextBtn').show();
      $('#generateBtn').hide();
    }

    // Recalcular responsive de la tabla del paso actual
    recalcCurrentStepTable();
  }

  $('#nextBtn').click(function ()   { if (currentStep < totalSteps) { currentStep++; updateStepUI(); } });
  $('#prevBtn').click(function ()   { if (currentStep > 1)          { currentStep--; updateStepUI(); } });

  $('#generateBtn').click(function () {
    calcularTodo();
    alert('Presupuesto generado. Los valores se han calculado y pueden visualizarse en el resumen final del modal y en la página principal.');
    bootstrap.Modal.getInstance($('#costeoModal')[0]).hide();
  });

  /* ── Tours de ayuda (Intro.js) ──────────────────────── */
  function crearTourPaso(paso) {
    const tours = {
      1: [
        { element: '#step1 .card-header',   intro: 'Paso 1: Datos generales. Configura los supuestos básicos del producto.',       position: 'bottom' },
        { element: '#productoNombre',        intro: 'Nombre del producto que estás presupuestando.',                                position: 'bottom' },
        { element: '#unidadVenta',           intro: 'Unidad de venta. Puedes escribir cualquier unidad personalizada.',             position: 'bottom' },
        { element: '#tasaCambio',            intro: 'Tasa de cambio actual (Bs./$). Actualízala manualmente o con el botón API.',   position: 'bottom' },
        { element: '#btnActualizarApi',      intro: 'Haz clic para obtener la tasa de cambio desde una API externa.',               position: 'bottom' },
        { element: '#porcUtilidad',          intro: 'Porcentaje de utilidad deseada (decimal, ej. 0.35 = 35%).',                    position: 'bottom' },
        { element: '#loteBase',              intro: 'Cantidad base del lote. Sirve para calcular costos unitarios.',                position: 'bottom' },
        { element: '#porcIva',               intro: 'Porcentaje de IVA (decimal, ej. 0.16 = 16%).',                                position: 'bottom' }
      ],
      2: [
        { element: '#step2 .card-header',                             intro: 'Paso 2: Materia prima. Agrega los insumos necesarios.',               position: 'bottom' },
        { element: '#addRowMP',                                        intro: 'Botón para agregar nuevas filas de insumos.',                         position: 'bottom' },
        { element: '#tablaMP thead',                                   intro: 'Columnas: Insumo, Cantidad, Unidad, Costo USD, Costo Bs., Subtotales y Acciones.', position: 'bottom' },
        { element: '#tablaMP tbody tr:first-child .cantidad',          intro: 'Cantidad del insumo.',                                               position: 'bottom' },
        { element: '#tablaMP tbody tr:first-child select',             intro: 'Unidad de medida. Puedes escribir unidades personalizadas.',          position: 'bottom' },
        { element: '#tablaMP tbody tr:first-child .costo-usd',         intro: 'Costo en USD. Se formatea automáticamente.',                         position: 'bottom' },
        { element: '#tablaMP tbody tr:first-child .costo-bs',          intro: 'Costo en Bs. (calculado según la tasa de cambio).',                  position: 'bottom' },
        { element: '#tablaMP tbody tr:first-child .subtotal-usd',      intro: 'Subtotal en USD (cantidad × costo USD).',                            position: 'bottom' },
        { element: '#tablaMP tbody tr:first-child .subtotal-bs',       intro: 'Subtotal en Bs. (cantidad × costo Bs.).',                            position: 'bottom' },
        { element: '.remove-row',                                      intro: 'Botón para eliminar la fila.',                                       position: 'bottom' },
        { element: '#totalMPUsd',                                      intro: 'Total de materia prima en USD.',                                     position: 'bottom' },
        { element: '#totalMPBs',                                       intro: 'Total de materia prima en Bs.',                                      position: 'bottom' }
      ],
      3: [
        { element: '#step3 .card-header',                              intro: 'Paso 3: Mano de obra directa.',                                      position: 'bottom' },
        { element: '#selectUnidadTiempo',                              intro: 'Selecciona la unidad de tiempo (hora, día, semana, mes).',           position: 'bottom' },
        { element: '#addRowMOD',                                       intro: 'Agregar nuevo cargo.',                                               position: 'bottom' },
        { element: '#tablaMOD tbody tr:first-child td:first-child input', intro: 'Nombre del cargo.',                                              position: 'bottom' },
        { element: '#tablaMOD tbody tr:first-child .pago-usd',         intro: 'Pago en USD por unidad de tiempo.',                                 position: 'bottom' },
        { element: '#tablaMOD tbody tr:first-child .pago-bs',          intro: 'Pago en Bs. (calculado automáticamente).',                          position: 'bottom' },
        { element: '#tablaMOD tbody tr:first-child .cantidad-tiempo',  intro: 'Cantidad de unidades de tiempo trabajadas.',                        position: 'bottom' },
        { element: '#tablaMOD tbody tr:first-child .subtotal-bs',      intro: 'Subtotal en Bs. (pago Bs. × cantidad).',                            position: 'bottom' },
        { element: '#tablaMOD tbody tr:first-child .subtotal-usd',     intro: 'Subtotal en USD (pago USD × cantidad).',                            position: 'bottom' }
      ],
      4: [
        { element: '#step4 .card-header',                              intro: 'Paso 4: Costos Indirectos de Fabricación (CIF).',                   position: 'bottom' },
        { element: '#addRowCIF',                                       intro: 'Agregar nuevo concepto.',                                            position: 'bottom' },
        { element: '#tablaCIF tbody tr:first-child td:first-child input',    intro: 'Descripción del costo indirecto.',                            position: 'bottom' },
        { element: '#tablaCIF tbody tr:first-child td:nth-child(2) input',   intro: 'Base de cálculo (texto libre).',                              position: 'bottom' },
        { element: '#tablaCIF tbody tr:first-child .costo-usd',        intro: 'Costo en USD.',                                                     position: 'bottom' },
        { element: '#tablaCIF tbody tr:first-child .costo-bs',         intro: 'Costo en Bs. (calculado).',                                         position: 'bottom' },
        { element: '#tablaCIF tbody tr:first-child .total-usd',        intro: 'Total en USD.',                                                     position: 'bottom' },
        { element: '#tablaCIF tbody tr:first-child .total-bs',         intro: 'Total en Bs.',                                                      position: 'bottom' }
      ],
      5: [
        { element: '#step5 .card-header',    intro: 'Paso 5: Resumen y comparativo.',                                              position: 'bottom' },
        { element: '#resumenFinal',          intro: 'Resumen detallado de costos, utilidad, precios de venta y finales.',          position: 'bottom' },
        { element: '#tablaComparativa',      intro: 'Comparativo para lotes de 12, 10 y 6 unidades en Bs. y USD.',                position: 'bottom' },
        { element: '#costoUnitario',         intro: 'Costo unitario por unidad de venta.',                                        position: 'bottom' },
        { element: '#precioVentaUnitario',   intro: 'Precio de venta unitario (sin IVA).',                                        position: 'bottom' },
        { element: '#precioFinalUnitario',   intro: 'Precio final unitario (con IVA).',                                           position: 'bottom' }
      ]
    };
    return tours[paso] || [];
  }

  function lanzarTour(steps) {
    introJs().setOptions({
      steps,
      nextLabel: 'Siguiente',
      prevLabel: 'Anterior',
      doneLabel: 'Entendido',
      exitOnOverlayClick: false
    }).start();
  }

  $('.btn-help').on('click', function () {
    lanzarTour(crearTourPaso($(this).data('step')));
  });

  $('#btnAyudaPrincipal').on('click', function () {
    lanzarTour([
      { element: 'body',                          intro: 'Bienvenido al sistema de costos de producción. Esta es la pantalla principal.', position: 'center' },
      { element: 'h2',                            intro: 'Aquí puedes iniciar un nuevo presupuesto haciendo clic en el botón.',           position: 'bottom' },
      { element: '[data-bs-target="#costeoModal"]', intro: 'Este botón abre el modal para crear un nuevo presupuesto.',                   position: 'bottom' },
      { element: '#resumen-ejecutivo-table',      intro: 'Resumen ejecutivo del último presupuesto generado.',                           position: 'top'    },
      { element: '.leyenda-box',                  intro: 'Verde: costo total · Rojo: precio de venta · Amarillo: precio final.',         position: 'bottom' }
    ]);
  });

  /* ── Inicialización ─────────────────────────────────── */
  $('#costeoModal').on('show.bs.modal', function () {
    currentStep = 1;
    updateStepUI();
    calcularTodo();
  });

  // Ajustar DataTables responsive después de que el modal sea visible
  $('#costeoModal').on('shown.bs.modal', function () {
    tableMP.columns.adjust().responsive.recalc();
    tableMOD.columns.adjust().responsive.recalc();
    tableCIF.columns.adjust().responsive.recalc();
    tableComparativa.columns.adjust().responsive.recalc();
  });

  // Formatear valores iniciales de inputs de precio
  $('.input-price').each(function () { $(this).trigger('input'); });

  calcularTodo();
});