import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'transactions_v1';
const CATEGORIES = {
  expense: ['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Other'],
  income: ['Salary', 'Freelance', 'Gift', 'Other'],
};

const money = (n) =>
  (n < 0 ? '-' : '') + '$' + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

function Main() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState(CATEGORIES.expense[0]);
  const [filter, setFilter] = useState('all'); // all | today

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setItems(JSON.parse(raw));
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items, loaded]);

  const switchType = (t) => {
    setType(t);
    setCategory(CATEGORIES[t][0]);
  };

  const add = () => {
    const value = parseFloat(amount.replace(',', '.'));
    if (!value || value <= 0) return Alert.alert('Enter a valid amount');
    setItems((prev) => [
      { id: Date.now().toString(), type, amount: value, category, note: note.trim(), date: new Date().toISOString() },
      ...prev,
    ]);
    setAmount('');
    setNote('');
  };

  const remove = (id) =>
    Alert.alert('Delete entry?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setItems((p) => p.filter((i) => i.id !== id)) },
    ]);

  const visible = useMemo(
    () => (filter === 'today' ? items.filter((i) => new Date(i.date).toDateString() === new Date().toDateString()) : items),
    [items, filter]
  );

  const totals = useMemo(() => {
    const income = visible.filter((i) => i.type === 'income').reduce((s, i) => s + i.amount, 0);
    const expense = visible.filter((i) => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
    return { income, expense, balance: income - expense };
  }, [visible]);

  const renderItem = ({ item, index }) => {
    const showHeader = index === 0 || dayLabel(visible[index - 1].date) !== dayLabel(item.date);
    const isInc = item.type === 'income';
    return (
      <View>
        {showHeader && <Text style={styles.dayHeader}>{dayLabel(item.date)}</Text>}
        <TouchableOpacity style={styles.row} onLongPress={() => remove(item.id)} delayLongPress={350}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{item.category}</Text>
            {!!item.note && <Text style={styles.rowNote}>{item.note}</Text>}
          </View>
          <Text style={[styles.rowAmount, { color: isInc ? GREEN : RED }]}>
            {isInc ? '+' : '-'}{money(item.amount).replace('-', '')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={visible}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListHeaderComponent={
            <View>
              <Text style={styles.title}>Expense Tracker</Text>

              <View style={styles.card}>
                <Text style={styles.cardLabel}>Balance</Text>
                <Text style={styles.balance}>{money(totals.balance)}</Text>
                <View style={styles.cardRow}>
                  <View>
                    <Text style={styles.cardLabel}>Income</Text>
                    <Text style={[styles.cardSub, { color: GREEN }]}>{money(totals.income)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.cardLabel}>Expenses</Text>
                    <Text style={[styles.cardSub, { color: RED }]}>{money(totals.expense)}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.form}>
                <View style={styles.toggle}>
                  {['expense', 'income'].map((t) => (
                    <TouchableOpacity key={t} onPress={() => switchType(t)}
                      style={[styles.toggleBtn, type === t && { backgroundColor: t === 'income' ? GREEN : RED }]}>
                      <Text style={[styles.toggleText, type === t && { color: '#fff' }]}>
                        {t === 'income' ? 'Income' : 'Expense'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput style={styles.input} placeholder="Amount" keyboardType="decimal-pad"
                  value={amount} onChangeText={setAmount} />
                <TextInput style={styles.input} placeholder="Note (optional)"
                  value={note} onChangeText={setNote} />

                <View style={styles.chips}>
                  {CATEGORIES[type].map((c) => (
                    <TouchableOpacity key={c} onPress={() => setCategory(c)}
                      style={[styles.chip, category === c && styles.chipActive]}>
                      <Text style={[styles.chipText, category === c && { color: '#fff' }]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={styles.addBtn} onPress={add}>
                  <Text style={styles.addText}>Add {type}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.filterRow}>
                <Text style={styles.sectionTitle}>Transactions</Text>
                <View style={{ flexDirection: 'row' }}>
                  {['all', 'today'].map((f) => (
                    <TouchableOpacity key={f} onPress={() => setFilter(f)}
                      style={[styles.filterBtn, filter === f && styles.filterActive]}>
                      <Text style={[styles.filterText, filter === f && { color: '#fff' }]}>
                        {f === 'all' ? 'All' : 'Today'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>No transactions yet.{'\n'}Long-press an entry to delete it.</Text>}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

const GREEN = '#16a34a';
const RED = '#dc2626';
const INK = '#111827';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f3f4f6' },
  title: { fontSize: 26, fontWeight: '700', color: INK, marginBottom: 12 },
  card: { backgroundColor: INK, borderRadius: 16, padding: 20, marginBottom: 16 },
  cardLabel: { color: '#9ca3af', fontSize: 13 },
  balance: { color: '#fff', fontSize: 34, fontWeight: '700', marginVertical: 6 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cardSub: { fontSize: 18, fontWeight: '600' },
  form: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20 },
  toggle: { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 10, marginBottom: 12 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  toggleText: { fontWeight: '600', color: '#374151' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#e5e7eb', marginRight: 8, marginBottom: 8 },
  chipActive: { backgroundColor: INK },
  chipText: { color: '#374151', fontSize: 14 },
  addBtn: { backgroundColor: INK, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 },
  addText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: INK },
  filterBtn: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#e5e7eb', marginLeft: 6 },
  filterActive: { backgroundColor: INK },
  filterText: { color: '#374151', fontSize: 13 },
  dayHeader: { marginTop: 14, marginBottom: 6, color: '#6b7280', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 6 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: INK },
  rowNote: { color: '#6b7280', marginTop: 2 },
  rowAmount: { fontSize: 16, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 30, lineHeight: 22 },
});
