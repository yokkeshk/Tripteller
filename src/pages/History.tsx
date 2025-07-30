import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAppSelector } from "../store/hooks";
import {
  MapPin,
  Shuffle,
  Ruler,
  CalendarDays,
  FileDown,
  FileText,
  Filter,
  XCircle,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./history.scss";

interface HistoryItem {
  from: string;
  to: string;
  distance: number | string;
  date: string;
}

const History: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filtered, setFiltered] = useState<HistoryItem[]>([]);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    fromDate: "",
    toDate: "",
  });

  const authState = useAppSelector((state) => state.auth);

  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = authState.userId || user._id || user.id;

      if (!userId) {
        console.warn("No user ID found, cannot fetch history.");
        return;
      }

      try {
        const res = await axios.get(
          `http://localhost:5000/api/history/${userId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setHistory(res.data);
        setFiltered(res.data);
      } catch (err) {
        console.error("Error fetching history:", err);
      }
    };

    fetchHistory();
  }, [authState.userId]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    const { from, to, fromDate, toDate } = filters;

    const result = history.filter((item) => {
      const itemDate = new Date(item.date);
      const matchesFrom = from ? item.from.toLowerCase().includes(from.toLowerCase()) : true;
      const matchesTo = to ? item.to.toLowerCase().includes(to.toLowerCase()) : true;
      const matchesFromDate = fromDate ? itemDate >= new Date(fromDate) : true;
      const matchesToDate = toDate ? itemDate <= new Date(toDate) : true;

      return matchesFrom && matchesTo && matchesFromDate && matchesToDate;
    });

    setFiltered(result);
  };

  const resetFilters = () => {
    setFilters({ from: "", to: "", fromDate: "", toDate: "" });
    setFiltered(history);
  };

  const exportCSV = () => {
    const headers = ["From", "To", "Distance (km)", "Date"];
    const rows = filtered.map((item) => [
      item.from,
      item.to,
      Number(item.distance).toFixed(2),
      new Date(item.date).toLocaleString(),
    ]);
    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trip-history.csv";
    a.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Trip History", 14, 22);

    const tableColumn = ["From", "To", "Distance (km)", "Date"];
    const tableRows = filtered.map((item) => [
      item.from,
      item.to,
      Number(item.distance).toFixed(2),
      new Date(item.date).toLocaleString(),
    ]);

    autoTable(doc, {
      startY: 30,
      head: [tableColumn],
      body: tableRows,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    });

    doc.save("trip-history.pdf");
  };

  return (
    <div className="history-container">
      <div className="history-header">
        <h2>📍History</h2>
        <div className="button-group">
          <button className="export-btn" onClick={exportCSV}>
            <FileDown size={18} /> Export CSV
          </button>
          <button className="export-btn pdf" onClick={exportPDF}>
            <FileText size={18} /> Export PDF
          </button>
        </div>
      </div>

      <div className="filters">
        <input
          type="text"
          name="from"
          placeholder="From location"
          value={filters.from}
          onChange={handleFilterChange}
        />
        <input
          type="text"
          name="to"
          placeholder="To location"
          value={filters.to}
          onChange={handleFilterChange}
        />
        <input
          type="date"
          name="fromDate"
          value={filters.fromDate}
          onChange={handleFilterChange}
        />
        <input
          type="date"
          name="toDate"
          value={filters.toDate}
          onChange={handleFilterChange}
        />
        <button onClick={applyFilters}>
          <Filter size={16} /> Apply
        </button>
        <button className="reset-btn" onClick={resetFilters}>
          <XCircle size={16} /> Reset
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="no-history">No history found.</div>
      ) : (
        <div className="table-wrapper">
          <table className="history-table">
            <thead>
              <tr>
                <th><MapPin size={16} /> From</th>
                <th><Shuffle size={16} /> To</th>
                <th><Ruler size={16} /> Distance (km)</th>
                <th><CalendarDays size={16} /> Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, index) => (
                <tr key={index}>
                  <td>{item.from}</td>
                  <td>{item.to}</td>
                  <td>{Number(item.distance).toFixed(2)}</td>
                  <td>{new Date(item.date).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default History;
