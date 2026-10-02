import{j as e}from"./framer-motion-CfCsi_Pw.js";import{d as x,a as u,b as h,R as f,i as N}from"./index-CO495Km-.js";import{C as g,d as y}from"./card-DcTVYANi.js";import{B as l}from"./badge-BJRUZQyv.js";import{S as b,T as v,a as j,b as d,c as n,d as w,e as i}from"./ScrollableTable-BzU2-lbG.js";import{r as C}from"./react-vendor-Lti2nL0Q.js";import{D as T,a as D,b as P,c as R}from"./dialog-XbzR23Ig.js";import{f as o}from"./format-CSQe5d3I.js";import{P as S}from"./printer-DpaWAhM3.js";import"./radix-ui-Dm-TszZa.js";import"./charts-CUOotrmL.js";function k(s){const r=new Date(s.paymentDate),t=r.toLocaleDateString("en-PH"),c=r.toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"}),a=new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",minimumFractionDigits:2}).format(s.amount);return`
    <div style="font-family: 'Courier New', monospace; font-size: 12px; width: 280px; padding: 8px; color: #000; background: #fff;">
      <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
        <div style="font-weight: bold; font-size: 14px;">${s.companyName||"EVANGELIST FUNERAL SERVICES"}</div>
        <div style="font-size: 10px; margin-top: 2px;">Pre-Need Deathcare Plan</div>
      </div>

      <div style="text-align: center; margin-bottom: 8px;">
        <div style="font-weight: bold; font-size: 13px;">OFFICIAL RECEIPT</div>
        <div style="font-size: 11px; font-weight: bold;">${s.receiptNumber}</div>
      </div>

      <div style="margin-bottom: 8px;">
        <div>Date: ${t} ${c}</div>
        <div>Received from: ${s.issuedTo}</div>
        <div>Plan Type: ${s.planType}</div>
        <div>Contract #: ${s.contractNumber}</div>
      </div>

      <div style="text-align: center; margin: 10px 0; padding: 8px; border-top: 1px dashed #000; border-bottom: 1px dashed #000;">
        <div style="font-size: 10px;">AMOUNT RECEIVED</div>
        <div style="font-size: 16px; font-weight: bold; letter-spacing: 1px;">${a}</div>
      </div>

      <div style="margin-bottom: 8px;">
        <div>Payment Via: ${s.paymentChannel.replace("_"," ").toUpperCase()}</div>
      </div>

      <div style="text-align: center; margin-top: 12px; border-top: 1px dashed #000; padding-top: 8px;">
        <div style="font-size: 10px;">This is a computer-generated receipt.</div>
        <div style="font-size: 10px;">No signature required.</div>
        <div style="font-size: 9px; margin-top: 4px;">Served by: ${s.issuedByName}</div>
      </div>
    </div>
  `}function E(s){const r=k(s),t=window.open("","_blank","width=320,height=600");t&&(t.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt ${s.receiptNumber}</title>
      <style>
        @media print {
          @page { size: 80mm auto; margin: 2mm; }
          body { margin: 0; padding: 0; }
        }
        body { font-family: 'Courier New', monospace; }
      </style>
    </head>
    <body>
      ${r}
      <script>
        window.onload = function() {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `),t.document.close())}const m={cash:"Cash",gcash:"GCash",maya:"Maya",bank_transfer:"Bank Transfer",check:"Check"};function p(s){return new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",minimumFractionDigits:0}).format(s)}function U(){const{queryBranchId:s}=x(),r=u(h.receipts.list,{branchId:s}),[t,c]=C.useState(null);return e.jsxs("div",{className:"p-5 md:p-8 space-y-5 md:space-y-6",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-3xl font-bold",children:"Receipts"}),e.jsx("p",{className:"text-sm text-muted-foreground mt-1",children:"Official receipts issued for payments"})]}),e.jsx(g,{className:"border-border/60 shadow-sm",children:e.jsx(y,{className:"p-0",children:e.jsx(b,{children:e.jsxs(v,{children:[e.jsx(j,{children:e.jsxs(d,{className:"hover:bg-transparent",children:[e.jsx(n,{className:"text-[13px] uppercase tracking-wider font-medium",children:"Receipt #"}),e.jsx(n,{className:"text-[13px] uppercase tracking-wider font-medium",children:"Date"}),e.jsx(n,{className:"text-[13px] uppercase tracking-wider font-medium",children:"Issued To"}),e.jsx(n,{className:"text-[13px] uppercase tracking-wider font-medium",children:"Plan"}),e.jsx(n,{className:"text-[13px] uppercase tracking-wider font-medium",children:"Channel"}),e.jsx(n,{className:"text-[13px] uppercase tracking-wider font-medium",children:"Status"}),e.jsx(n,{className:"text-[13px] uppercase tracking-wider font-medium text-right",children:"Amount"})]})}),e.jsx(w,{children:r?r.length===0?e.jsx(d,{children:e.jsxs(i,{colSpan:7,className:"text-center py-10",children:[e.jsx(f,{className:"h-10 w-10 mx-auto text-muted-foreground/40 mb-3"}),e.jsx("p",{className:"text-base text-muted-foreground",children:"No receipts issued yet"})]})}):r.map(a=>e.jsxs(d,{className:"cursor-pointer hover:bg-muted/50",onClick:()=>c(a),children:[e.jsx(i,{className:"text-[14px] font-medium",children:a.receiptNumber}),e.jsx(i,{className:"text-[14px]",children:o(new Date(a.paymentDate),"MMM d, yyyy")}),e.jsx(i,{children:e.jsx("p",{className:"text-[15px]",children:a.issuedTo})}),e.jsx(i,{className:"text-[14px]",children:a.planType}),e.jsx(i,{children:e.jsx(l,{variant:"outline",className:"text-[12px]",children:m[a.paymentChannel]||a.paymentChannel})}),e.jsx(i,{children:e.jsx(l,{variant:"outline",className:`text-[12px] ${a.status==="active"?"terminal-status-current":a.status==="cancelled"?"terminal-status-claim":"text-muted-foreground"}`,children:a.status})}),e.jsx(i,{className:"text-right",children:e.jsx("span",{className:"font-bold text-terminal-green text-[15px]",children:p(a.amount)})})]},a._id)):e.jsx(d,{children:e.jsx(i,{colSpan:7,className:"text-center py-10 text-muted-foreground text-base",children:"Loading receipts..."})})})]})})})}),e.jsx(T,{open:!!t,onOpenChange:a=>!a&&c(null),children:e.jsxs(D,{className:"max-w-md mx-2 sm:mx-0 max-h-[90vh] overflow-y-auto",children:[e.jsx(P,{children:e.jsx(R,{className:"text-xl font-bold",children:"Official Receipt"})}),t&&e.jsxs("div",{className:"border border-border rounded-lg p-6 space-y-4 bg-white",children:[e.jsxs("div",{className:"text-center border-b border-border pb-4",children:[e.jsx("h3",{className:"font-bold text-xl tracking-tight",children:"Evangelist Funeral Services"}),e.jsx("p",{className:"text-[12px] text-muted-foreground uppercase tracking-wider mt-1",children:"Pre-Need Funeral & Deathcare Services"}),e.jsx("p",{className:"text-[12px] text-muted-foreground mt-1",children:"Official Receipt"})]}),e.jsxs("div",{className:"flex justify-between items-center",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-[12px] text-muted-foreground uppercase",children:"Receipt No."}),e.jsx("p",{className:"text-[15px] font-bold",children:t.receiptNumber})]}),e.jsxs("div",{className:"text-right",children:[e.jsx("p",{className:"text-[12px] text-muted-foreground uppercase",children:"Date"}),e.jsx("p",{className:"text-[15px]",children:o(new Date(t.paymentDate),"MMMM d, yyyy")})]})]}),e.jsxs("div",{className:"space-y-1 border-t border-border pt-3",children:[e.jsx("p",{className:"text-[12px] text-muted-foreground uppercase",children:"Received From"}),e.jsx("p",{className:"text-[15px] font-medium",children:t.issuedTo})]}),e.jsxs("div",{className:"space-y-1",children:[e.jsx("p",{className:"text-[12px] text-muted-foreground uppercase",children:"Contract"}),e.jsx("p",{className:"text-[15px]",children:t.contractNumber}),e.jsx("p",{className:"text-[13px] text-muted-foreground",children:t.planType})]}),e.jsxs("div",{className:"border-t border-border pt-3",children:[e.jsxs("div",{className:"flex justify-between items-baseline",children:[e.jsx("p",{className:"text-[12px] text-muted-foreground uppercase",children:"Amount Paid"}),e.jsx("p",{className:"text-2xl font-bold text-terminal-green",children:p(t.amount)})]}),e.jsxs("p",{className:"text-[12px] text-muted-foreground text-right mt-1",children:["via ",m[t.paymentChannel]||t.paymentChannel]})]}),e.jsxs(N,{variant:"outline",size:"default",className:"w-full gap-2 h-11 text-[14px]",onClick:()=>E({receiptNumber:t.receiptNumber,amount:t.amount,paymentChannel:t.paymentChannel,paymentDate:t.paymentDate,issuedTo:t.issuedTo,planType:t.planType,contractNumber:t.contractNumber,issuedByName:"Staff",companyName:"Evangelist Funeral Services"}),children:[e.jsx(S,{className:"h-4 w-4"})," Print Thermal Receipt"]}),e.jsx("div",{className:"text-center pt-2",children:e.jsx(l,{variant:"outline",className:`text-[12px] ${t.status==="active"?"terminal-status-current":"terminal-status-claim"}`,children:t.status.toUpperCase()})})]})]})})]})}export{U as default};
